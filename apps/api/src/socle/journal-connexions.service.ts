import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ParametresService } from './parametres.service';
import { TachesPlanifieesService } from './taches-planifiees.service';

/**
 * Journal technique des connexions (SOC-SEC-05), distinct du journal d'audit (qui ne se purge
 * jamais) : réussites et échecs, IP, navigateur ; conservé N mois (paramètre), puis purgé.
 */
@Injectable()
export class JournalConnexionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly parametres: ParametresService,
    private readonly taches: TachesPlanifieesService,
  ) {}

  async enregistrer(e: { userId: string | null; email: string; resultat: 'SUCCES' | 'ECHEC'; motif?: string; ip?: string; navigateur?: string }): Promise<void> {
    await this.prisma.journalConnexion
      .create({ data: { userId: e.userId, email: e.email.slice(0, 200), resultat: e.resultat, motif: e.motif ?? null, ip: e.ip?.slice(0, 100) ?? null, navigateur: e.navigateur?.slice(0, 300) ?? null } })
      .catch(() => undefined); // un journal technique ne bloque jamais une connexion
  }

  /** Purge au-delà de la durée de conservation ; `maintenant` simulable pour les tests. */
  async purger(maintenant = new Date()): Promise<{ supprimees: number; conservationMois: number; historiqueTaches: number }> {
    const mois = await this.parametres.valeur('connexions.conservationMois');
    const limite = new Date(maintenant);
    limite.setUTCMonth(limite.getUTCMonth() - mois);
    const supprimees = (await this.prisma.journalConnexion.deleteMany({ where: { createdAt: { lt: limite } } })).count;
    return { supprimees, conservationMois: mois, historiqueTaches: await this.taches.purger(maintenant) };
  }

  @Cron('30 0 * * *')
  async purgeQuotidienne(): Promise<void> {
    await this.taches.suivre('purge-connexions', () => this.purger());
  }
}
