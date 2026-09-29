import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Tâches planifiées suivies par la supervision (nom technique → libellé affiché). */
export const TACHES_SUIVIES: Record<string, { libelle: string; periodeMinutes: number }> = {
  'fins-prevues': { libelle: 'Fins de stage et de contrat (alertes, départs)', periodeMinutes: 24 * 60 },
  'rotation-stages': { libelle: 'Rotation des stagiaires', periodeMinutes: 24 * 60 },
  'purge-connexions': { libelle: 'Purge des journaux de connexion', periodeMinutes: 24 * 60 },
  'scellement-audit': { libelle: 'Scellement du journal d’audit', periodeMinutes: 60 },
  supervision: { libelle: 'Surveillance des services', periodeMinutes: 10 },
};

/**
 * Trace d'exécution des tâches planifiées (supervision, SOC-SUP-01) : début, fin, résultat.
 * Une erreur est enregistrée puis relancée (le planificateur la journalise comme avant).
 */
@Injectable()
export class TachesPlanifieesService {
  private readonly logger = new Logger('TachesPlanifiees');

  constructor(private readonly prisma: PrismaService) {}

  async suivre<T>(tache: string, fn: () => Promise<T>): Promise<T> {
    const exec = await this.prisma.executionTache.create({ data: { tache, statut: 'EN_COURS' }, select: { id: true } }).catch(() => null);
    try {
      const r = await fn();
      if (exec) {
        const details = r && typeof r === 'object' && JSON.stringify(r).length < 2000 ? (r as unknown as Prisma.InputJsonValue) : undefined;
        await this.prisma.executionTache.update({ where: { id: exec.id }, data: { statut: 'SUCCES', fin: new Date(), details } }).catch(() => undefined);
      }
      return r;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`${tache} : ${message}`);
      if (exec) await this.prisma.executionTache.update({ where: { id: exec.id }, data: { statut: 'ECHEC', fin: new Date(), message: message.slice(0, 1000) } }).catch(() => undefined);
      throw e;
    }
  }

  /** Dernière exécution de chaque tâche suivie. */
  async dernieres() {
    return Promise.all(
      Object.entries(TACHES_SUIVIES).map(async ([tache, d]) => {
        const e = await this.prisma.executionTache.findFirst({ where: { tache }, orderBy: { debut: 'desc' } });
        const echecs24h = await this.prisma.executionTache.count({ where: { tache, statut: 'ECHEC', debut: { gte: new Date(Date.now() - 864e5) } } });
        return { tache, libelle: d.libelle, periodeMinutes: d.periodeMinutes, derniere: e ? { debut: e.debut, fin: e.fin, statut: e.statut, message: e.message } : null, echecs24h };
      }),
    );
  }

  /** Historique conservé 30 jours. */
  async purger(maintenant = new Date()): Promise<number> {
    return (await this.prisma.executionTache.deleteMany({ where: { debut: { lt: new Date(maintenant.getTime() - 30 * 864e5) } } })).count;
  }
}
