import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { AuditAction } from '@prisma/client';
import { AuditService } from '../common/audit/audit.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ArriveesService } from './arrivees.service';
import { ActesService } from './actes.service';
import { ActeFiltresDto } from './dto/acte.dto';
import { ArriveeFiltresDto } from './dto/arrivee.dto';

function jour(d: Date | string | null | undefined): string {
  return d ? new Date(d).toLocaleDateString('fr-FR') : '';
}

/**
 * Export Excel des registres — même mécanisme que l'export des tâches
 * (ExcelJS, module export/). Les lignes viennent des MÊMES méthodes que
 * l'écran (ArriveesService.lister / ActesService.lister) : même filtre de
 * visibilité, même projection (objet absent là où la matrice le masque).
 * Un export ne peut donc jamais contenir une ligne ou un champ que l'écran
 * ne montre pas. Chaque export est audité.
 */
@Injectable()
export class CourrierExportService {
  constructor(
    private readonly arrivees: ArriveesService,
    private readonly actes: ActesService,
    private readonly audit: AuditService,
  ) {}

  async arriveesExcel(actor: AuthenticatedUser, filtres: ArriveeFiltresDto): Promise<Buffer> {
    const lignes = await this.arrivees.lister(actor, filtres);
    const { workbook, sheet } = this.classeur('Courrier arrivée', [
      { header: 'Numéro', key: 'numero', width: 22 },
      { header: 'Registre', key: 'registre', width: 14 },
      { header: 'Reçu le', key: 'dateReception', width: 12 },
      { header: 'Expéditeur', key: 'expediteur', width: 32 },
      { header: 'Objet', key: 'objet', width: 48 },
      { header: 'Confidentialité', key: 'confidentialite', width: 15 },
      { header: 'Statut', key: 'statut', width: 12 },
    ]);
    for (const a of lignes) {
      sheet.addRow({
        numero: a.numero,
        registre: a.registre.code,
        dateReception: jour(a.dateReception),
        expediteur: a.expediteur,
        objet: a.objet ?? (a.niveau === 'EXISTENCE' ? '(pli personnel — contenu protégé)' : ''),
        confidentialite: a.confidentialite,
        statut: a.statut,
      });
    }
    await this.tracer(actor, 'arrivees', filtres, lignes.length);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  async actesExcel(actor: AuthenticatedUser, filtres: ActeFiltresDto): Promise<Buffer> {
    const lignes = await this.actes.lister(actor, filtres);
    const { workbook, sheet } = this.classeur('Départs et actes', [
      { header: 'Numéro', key: 'numero', width: 22 },
      { header: 'Registre', key: 'registre', width: 14 },
      { header: 'Objet', key: 'objet', width: 48 },
      { header: 'Destinataires', key: 'destinataires', width: 32 },
      { header: 'Confidentialité', key: 'confidentialite', width: 15 },
      { header: 'Statut', key: 'statut', width: 12 },
      { header: 'Signé le', key: 'signeAt', width: 12 },
    ]);
    for (const a of lignes) {
      sheet.addRow({
        numero: a.numero ?? '(non numéroté)',
        registre: a.registre.code,
        objet: a.objet,
        destinataires: a.destinataires ?? '',
        confidentialite: a.confidentialite,
        statut: a.statut,
        signeAt: jour(a.signeAt),
      });
    }
    await this.tracer(actor, 'actes', filtres, lignes.length);
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  private classeur(titre: string, columns: Partial<ExcelJS.Column>[]) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SI DNPEC';
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(titre);
    sheet.columns = columns;
    sheet.getRow(1).font = { bold: true };
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
    return { workbook, sheet };
  }

  private async tracer(actor: AuthenticatedUser, registre: string, filtres: object, lignes: number): Promise<void> {
    await this.audit.log({
      actorId: actor.id,
      // Sortie de données hors de l'application : tracée comme une publication.
      action: AuditAction.PUBLICATION,
      entityType: 'RegistreCourrier',
      entityId: registre,
      metadata: { event: 'export_excel', filtres: { ...filtres }, lignes },
    });
  }
}
