import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, EvaluationFormat, EvaluationStageStatut, NotificationType, PeriodeStageStatut, StageStatut, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { PersonnelHistoryService } from '../personnel/personnel-history.service';
import { StagesService } from './stages.service';
import { JOUR_MS, jour } from './unites-stage';

const LIEN = (id: string) => `/stages/${id}`;
const STAGIAIRE = { select: { id: true, firstName: true, lastName: true, role: true, status: true, divisionId: true, sectionId: true, celluleId: true } } as const;

/**
 * Job quotidien de la rotation des stagiaires (D6). Chaque action n'est faite
 * qu'une fois (horodatage réservé par updateMany conditionnel, comme les
 * rappels du courrier), dans cet ordre :
 * 1. périodes en cours arrivées à leur terme → terminées, évaluation demandée
 *    au tuteur (puis relance 3 jours après) ;
 * 2. périodes acceptées dont la date est venue → changement d'unité du
 *    stagiaire (historique de carrière), sauf unité suspendue ou compte
 *    inactif (alerte au DRH, le stagiaire reste dans son unité) ;
 * 3. périodes proposées non acceptées à leur date → alerte au DRH ;
 * 4. périodes acceptées commençant dans 3 jours → prévenir stagiaire, tuteur
 *    et responsable.
 */
@Injectable()
export class StagesRotationService {
  private readonly logger = new Logger(StagesRotationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly history: PersonnelHistoryService,
    private readonly stages: StagesService,
  ) {}

  @Cron('5 0 * * *')
  async tick(): Promise<void> {
    try {
      await this.executer();
    } catch (e) {
      this.logger.error(`Rotation des stagiaires : ${(e as Error).message}`);
    }
  }

  /** `now` injectable : les tests simulent les dates. */
  async executer(now: Date = new Date()) {
    const aujourdhui = jour(now);
    const bilan = { terminees: 0, evaluationsDemandees: 0, relances: 0, appliquees: 0, alertes: 0, aVenir: 0 };
    const ouvert = { stage: { statut: { in: [StageStatut.PREVU, StageStatut.EN_COURS] } } };

    // 1. Fin de période.
    const finies = await this.prisma.periodeStage.findMany({
      where: { ...ouvert, statut: PeriodeStageStatut.EN_COURS, dateFin: { lt: aujourdhui } },
      select: { id: true },
    });
    for (const { id } of finies) {
      const ok = await this.prisma.periodeStage.updateMany({ where: { id, statut: PeriodeStageStatut.EN_COURS }, data: { statut: PeriodeStageStatut.TERMINEE } });
      if (ok.count) {
        bilan.terminees++;
        await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: id, metadata: { event: 'terminee' } });
      }
    }
    const aEvaluer = await this.prisma.periodeStage.findMany({
      where: {
        ...ouvert,
        statut: PeriodeStageStatut.TERMINEE,
        formatEvaluation: { not: EvaluationFormat.AUCUNE },
        tuteurId: { not: null },
        OR: [{ evaluation: null }, { evaluation: { statut: { in: [EvaluationStageStatut.BROUILLON, EvaluationStageStatut.RENVOYEE] } } }],
      },
      select: { id: true, stageId: true, tuteurId: true, dateFin: true, rappelEvaluationAt: true, relanceEvaluationAt: true, stage: { select: { stagiaire: STAGIAIRE } } },
    });
    for (const p of aEvaluer) {
      const nom = `${p.stage.stagiaire.firstName} ${p.stage.stagiaire.lastName}`;
      if (!p.rappelEvaluationAt) {
        const r = await this.prisma.periodeStage.updateMany({ where: { id: p.id, rappelEvaluationAt: null }, data: { rappelEvaluationAt: now } });
        if (r.count) {
          bilan.evaluationsDemandees++;
          await this.notifications.notify(p.tuteurId!, NotificationType.STAGE_EVALUATION_A_FAIRE, 'Évaluation de stage à rédiger', `La période de ${nom} est terminée.`, LIEN(p.stageId));
        }
      } else if (!p.relanceEvaluationAt && now.getTime() - p.rappelEvaluationAt.getTime() >= 3 * JOUR_MS) {
        const r = await this.prisma.periodeStage.updateMany({ where: { id: p.id, relanceEvaluationAt: null }, data: { relanceEvaluationAt: now } });
        if (r.count) {
          bilan.relances++;
          await this.notifications.notify(p.tuteurId!, NotificationType.STAGE_EVALUATION_A_FAIRE, 'Rappel : évaluation de stage à rédiger', `L’évaluation de ${nom} est toujours attendue.`, LIEN(p.stageId));
        }
      }
    }

    // 2. Changement d'unité.
    const aAppliquer = await this.prisma.periodeStage.findMany({
      where: { ...ouvert, statut: PeriodeStageStatut.ACCEPTEE, dateDebut: { lte: aujourdhui }, dateFin: { gte: aujourdhui } },
      select: {
        id: true, stageId: true, divisionId: true, sectionId: true, celluleId: true, tuteurId: true, dateDebut: true, dateFin: true, alerteAt: true,
        division: { select: { isActive: true } }, section: { select: { isActive: true } }, cellule: { select: { isActive: true } },
        stage: { select: { stagiaire: STAGIAIRE } },
      },
      orderBy: { dateDebut: 'asc' },
    });
    for (const p of aAppliquer) {
      const st = p.stage.stagiaire;
      const nom = `${st.firstName} ${st.lastName}`;
      const suspendue = p.division?.isActive === false || p.section?.isActive === false || p.cellule?.isActive === false;
      const compteKo = st.status !== UserStatus.ACTIF || st.role !== SystemRole.STAGIAIRE;
      if (suspendue || compteKo) {
        if (await this.reserverAlerte(p.id, p.alerteAt, now)) {
          bilan.alertes++;
          await this.alerterDrh(p.stageId, suspendue ? `${nom} : l’unité d’accueil est suspendue, le changement d’unité n’a pas été fait. Corrigez le plan.` : `${nom} : le compte n’est plus un compte de stagiaire actif, le changement d’unité n’a pas été fait.`);
        }
        continue;
      }
      const vers = { divisionId: p.divisionId, sectionId: p.sectionId, celluleId: p.celluleId };
      const fait = await this.prisma.$transaction(async (tx) => {
        const r = await tx.periodeStage.updateMany({ where: { id: p.id, statut: PeriodeStageStatut.ACCEPTEE }, data: { statut: PeriodeStageStatut.EN_COURS, rattachementAppliqueAt: now } });
        if (!r.count) return false;
        await tx.user.update({ where: { id: st.id }, data: vers });
        await this.history.recordAffectationChange(st.id, st.id, st, vers, tx);
        await tx.stage.updateMany({ where: { id: p.stageId, statut: StageStatut.PREVU }, data: { statut: StageStatut.EN_COURS } });
        return true;
      });
      if (!fait) continue;
      bilan.appliquees++;
      await this.audit.log({ actorId: null, action: AuditAction.MODIFICATION, entityType: 'PeriodeStage', entityId: p.id, metadata: { event: 'rattachement_applique', userId: st.id, avant: { divisionId: st.divisionId, sectionId: st.sectionId, celluleId: st.celluleId }, apres: vers } });
      const unite = await this.history.describeAttachment(vers);
      await this.notifications.notifyMany([st.id, ...(p.tuteurId ? [p.tuteurId] : [])], NotificationType.STAGE_PERIODE_DEBUT, 'Début de période de stage', `${nom} rejoint ${unite} aujourd’hui.`, LIEN(p.stageId));
    }

    // 3. Période proposée non acceptée à sa date.
    const nonAcceptees = await this.prisma.periodeStage.findMany({
      where: { ...ouvert, statut: PeriodeStageStatut.PROPOSEE, dateDebut: { lte: aujourdhui }, alerteAt: null },
      select: { id: true, stageId: true, alerteAt: true, stage: { select: { stagiaire: STAGIAIRE } } },
    });
    for (const p of nonAcceptees) {
      if (await this.reserverAlerte(p.id, p.alerteAt, now)) {
        bilan.alertes++;
        await this.alerterDrh(p.stageId, `${p.stage.stagiaire.firstName} ${p.stage.stagiaire.lastName} : une période commence aujourd’hui sans avoir été acceptée par l’unité ; le stagiaire reste dans son unité actuelle.`);
      }
    }

    // 4. Trois jours avant.
    const bientot = await this.prisma.periodeStage.findMany({
      where: { ...ouvert, statut: PeriodeStageStatut.ACCEPTEE, rappelAVenirAt: null, dateDebut: { gt: aujourdhui, lte: new Date(aujourdhui.getTime() + 3 * JOUR_MS) } },
      select: { id: true, stageId: true, divisionId: true, sectionId: true, celluleId: true, tuteurId: true, dateDebut: true, stage: { select: { stagiaire: STAGIAIRE } } },
    });
    for (const p of bientot) {
      const r = await this.prisma.periodeStage.updateMany({ where: { id: p.id, rappelAVenirAt: null }, data: { rappelAVenirAt: now } });
      if (!r.count) continue;
      bilan.aVenir++;
      const dest = new Set<string>([p.stage.stagiaire.id, ...(p.tuteurId ? [p.tuteurId] : []), ...(await this.stages.responsables(p))]);
      const unite = await this.history.describeAttachment(p);
      await this.notifications.notifyMany([...dest], NotificationType.STAGE_PERIODE_A_VENIR, 'Période de stage à venir', `${p.stage.stagiaire.firstName} ${p.stage.stagiaire.lastName} rejoint ${unite} le ${p.dateDebut.toLocaleDateString('fr-FR', { timeZone: 'UTC' })}.`, LIEN(p.stageId));
    }
    return bilan;
  }

  private async reserverAlerte(id: string, deja: Date | null, now: Date): Promise<boolean> {
    if (deja) return false;
    const r = await this.prisma.periodeStage.updateMany({ where: { id, alerteAt: null }, data: { alerteAt: now } });
    return r.count > 0;
  }

  private async alerterDrh(stageId: string, message: string) {
    const drh = await this.prisma.user.findMany({ where: { role: SystemRole.DRH, status: UserStatus.ACTIF }, select: { id: true } });
    await this.notifications.notifyMany(drh.map((d) => d.id), NotificationType.STAGE_ALERTE, 'Alerte — rotation des stagiaires', message, LIEN(stageId));
  }
}
