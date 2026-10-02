import { readdir, stat } from 'fs/promises';
import * as path from 'path';
import { Injectable } from '@nestjs/common';
import { AuditAction, SystemRole } from '@prisma/client';
import archiver from 'archiver';
import type { Response } from 'express';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AutorisationService } from './autorisation.service';
import { PreuveIdentiteService } from './preuve-identite.service';

/**
 * Sauvegarde du stockage des fichiers (exploitation 2026-10) : le disque persistant de Render
 * (pièces jointes, documents de la GED, courrier numérisé) n'est PAS dans l'export de la base.
 * L'administrateur télécharge ici une archive ZIP de tout le dossier, à ranger avec l'export de la
 * base du même jour. Réservé à l'administrateur système, après confirmation du mot de passe (les
 * fichiers contiennent des pièces protégées), et tracé dans le journal d'audit. L'archive est
 * produite au fil de l'eau (aucune copie en mémoire ni sur le disque).
 */
@Injectable()
export class SauvegardeFichiersService {
  constructor(
    private readonly storage: StorageService,
    private readonly autorisation: AutorisationService,
    private readonly preuves: PreuveIdentiteService,
    private readonly audit: AuditService,
  ) {}

  /** Inventaire du dossier (nombre de fichiers, volume) : affiché avant le téléchargement. */
  async inventaire(actor: AuthenticatedUser): Promise<{ fichiers: number; octets: number }> {
    await this.exiger(actor, false);
    return this.compter();
  }

  async telecharger(actor: AuthenticatedUser, res: Response): Promise<void> {
    await this.exiger(actor, true);
    const { fichiers, octets } = await this.compter();
    await this.audit.log({ actorId: actor.id, action: AuditAction.CREATION, entityType: 'SauvegardeFichiers', entityId: 'stockage', metadata: { event: 'sauvegarde_fichiers', fichiers, octets } });
    const jour = new Date().toISOString().slice(0, 10);
    res.set({ 'Content-Type': 'application/zip', 'Content-Disposition': `attachment; filename="dnpec_fichiers_${jour}.zip"` });
    const zip = archiver('zip', { zlib: { level: 1 } }); // fichiers déjà compressés pour la plupart
    zip.on('error', (e) => res.destroy(e));
    zip.pipe(res);
    zip.directory(this.storage.root, false);
    await zip.finalize();
  }

  private async exiger(actor: AuthenticatedUser, preuve: boolean): Promise<void> {
    await this.autorisation.exiger(actor, { action: 'L', objet: { type: 'SauvegardeFichiers' }, positionsAcceptees: [SystemRole.ADMIN_SYSTEME], perimetre: 'IGNORE' });
    if (preuve) await this.preuves.exiger(actor);
  }

  private async compter(): Promise<{ fichiers: number; octets: number }> {
    let fichiers = 0;
    let octets = 0;
    const entrees = await readdir(this.storage.root).catch(() => [] as string[]);
    for (const nom of entrees) {
      const s = await stat(path.join(this.storage.root, nom)).catch(() => null);
      if (s?.isFile()) {
        fichiers++;
        octets += s.size;
      }
    }
    return { fichiers, octets };
  }
}
