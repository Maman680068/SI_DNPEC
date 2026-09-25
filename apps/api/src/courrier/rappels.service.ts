import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ArriveeStatut, AuditAction, ImputationStatut, NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { libelleCourrier } from './arrivees.service';

const JOUR = 24 * 60 * 60 * 1000;
/** Rappel d'échéance : 2 jours avant. */
const AVANCE_ECHEANCE_MS = 2 * JOUR;
/** Rappel de retard : le lendemain de l'échéance (24 h après). */
const DELAI_RETARD_MS = JOUR;

const IMPUTATION_RAPPEL_SELECT = {
  id: true,
  imputeAId: true,
  imputeParId: true,
  echeance: true,
  courrier: { select: { id: true, numero: true, objet: true, confidentialite: true } },
} as const;

/**
 * Rappels automatiques des imputations de courrier non traitées — même
 * mécanisme que le rappel de réunion (MeetingsService.sendDueReminders) :
 * tâche planifiée, horodatage en base. Chaque rappel n'est envoyé qu'UNE
 * fois : il est d'abord « réservé » par un updateMany conditionnel
 * (`<horodatage> IS NULL`), atomique — idempotent même après un redémarrage
 * ou avec deux instances de l'API. Emails sans objet pour un courrier
 * CONFIDENTIEL ou PERSONNEL (libelleCourrier).
 */
@Injectable()
export class CourrierRappelsService {
  private readonly logger = new Logger(CourrierRappelsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async tick(): Promise<void> {
    await this.envoyerRappels();
  }

  /** `now` injectable : les tests simulent les dates sans attendre. */
  async envoyerRappels(now: Date = new Date()): Promise<{ echeance: number; retard: number }> {
    const ouverts = { statut: ImputationStatut.EN_COURS, courrier: { statut: { notIn: [ArriveeStatut.ANNULE, ArriveeStatut.CLASSE] } } };

    const proches = await this.prisma.imputationCourrier.findMany({
      where: { ...ouverts, rappelEcheanceEnvoyeAt: null, echeance: { gt: now, lte: new Date(now.getTime() + AVANCE_ECHEANCE_MS) } },
      select: IMPUTATION_RAPPEL_SELECT,
    });
    let echeance = 0;
    for (const imp of proches) {
      const reserve = await this.prisma.imputationCourrier.updateMany({
        where: { id: imp.id, rappelEcheanceEnvoyeAt: null },
        data: { rappelEcheanceEnvoyeAt: now },
      });
      if (reserve.count === 0) continue;
      echeance++;
      await this.envoyer([imp.imputeAId], NotificationType.IMPUTATION_ECHEANCE_PROCHE, 'Échéance proche', imp, 'arrive à échéance le');
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'ImputationCourrier', entityId: imp.id, metadata: { event: 'rappel_echeance' } });
    }

    const enRetard = await this.prisma.imputationCourrier.findMany({
      where: { ...ouverts, rappelRetardEnvoyeAt: null, echeance: { lte: new Date(now.getTime() - DELAI_RETARD_MS) } },
      select: IMPUTATION_RAPPEL_SELECT,
    });
    let retard = 0;
    for (const imp of enRetard) {
      const reserve = await this.prisma.imputationCourrier.updateMany({
        where: { id: imp.id, rappelRetardEnvoyeAt: null },
        data: { rappelRetardEnvoyeAt: now },
      });
      if (reserve.count === 0) continue;
      retard++;
      await this.envoyer([imp.imputeAId, imp.imputeParId], NotificationType.IMPUTATION_EN_RETARD, 'Imputation en retard', imp, 'était attendu pour le');
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'ImputationCourrier', entityId: imp.id, metadata: { event: 'rappel_retard' } });
    }

    if (echeance + retard > 0) this.logger.log(`Rappels courrier envoyés : ${echeance} échéance(s) proche(s), ${retard} retard(s).`);
    return { echeance, retard };
  }

  private async envoyer(
    userIds: string[],
    type: NotificationType,
    titre: string,
    imp: { echeance: Date | null; courrier: Parameters<typeof libelleCourrier>[0] & { id: string } },
    verbe: string,
  ): Promise<void> {
    const date = imp.echeance?.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) ?? '';
    await this.notifications.notifyMany(
      [...new Set(userIds)],
      type,
      titre,
      `Le traitement du courrier ${libelleCourrier(imp.courrier)} ${verbe} ${date}.`,
      `/courrier?arrivee=${imp.courrier.id}`,
    );
  }
}
