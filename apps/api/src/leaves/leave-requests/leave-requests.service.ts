import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { AuditAction, LeaveRequestStatus, NotificationType, Prisma, RoleFonctionnel, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../../common/audit/audit.service';
import { CascadeService } from '../../org/cascade/cascade.service';
import { NotificationsService } from '../../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from '../dto/decide-leave-request.dto';
import { RejectLeaveRequestDto } from '../dto/reject-leave-request.dto';
import { AvisLeaveRequestDto } from '../dto/avis-leave-request.dto';
import { LeaveRequestFiltersDto } from '../dto/leave-request-filters.dto';
import { LeaveMedicalPrivacyService } from '../leave-medical-privacy.service';
import { detenteursWhere, estDrh } from '../../socle/roles-fonctionnels';
import { ParametresService } from '../../socle/parametres.service';
import { TachesPlanifieesService } from '../../socle/taches-planifiees.service';
import { PreuveIdentiteService } from '../../socle/preuve-identite.service';
import { ajouterHeuresOuvrees, heuresOuvreesEntre } from '../../socle/heures-ouvrees';

const LEAVE_REQUEST_SELECT = {
  id: true,
  userId: true,
  leaveTypeId: true,
  startDate: true,
  endDate: true,
  daysCount: true,
  reason: true,
  status: true,
  approverId: true,
  decisionComment: true,
  decidedAt: true,
  avisEtat: true,
  avisParId: true,
  avisMotif: true,
  avisLe: true,
  avisEcheance: true,
  alerteAvisAt: true,
  createdAt: true,
  updatedAt: true,
  leaveType: { select: { code: true, name: true } },
  user: { select: { id: true, firstName: true, lastName: true, role: true, divisionId: true, sectionId: true, celluleId: true, supervisorId: true } },
} satisfies Prisma.LeaveRequestSelect;

type LeaveRequestWithUser = Prisma.LeaveRequestGetPayload<{ select: typeof LEAVE_REQUEST_SELECT }>;

/** Étape du circuit A6.1, calculée (le statut en base reste celui de la v2 : compatibilité). */
export type EtapeConge = 'AVIS_ATTENDU' | 'DECISION_ATTENDUE' | 'APPROUVEE' | 'REFUSEE' | 'ANNULEE';

/** Vue exposée : type et motif médicaux masqués hors demandeur et DRH ; droits calculés ici. */
type LeaveRequestView = Omit<LeaveRequestWithUser, 'leaveTypeId' | 'leaveType'> & {
  leaveTypeId: string | null;
  leaveType: { code: string | null; name: string };
  etape: EtapeConge;
  motifVerrouille: boolean;
  avisPar: { id: string; nom: string } | null;
  droits: { peutDonnerAvis: boolean; peutDecider: boolean; peutAnnuler: boolean };
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Alerte au chef avant l'échéance de l'avis (heures ouvrées). */
export const ALERTE_AVIS_HEURES = 12;

/**
 * Congés et absences — circuit A6.1 du socle NIMBA (lot N3) :
 * agent → demande soumise (chef d'unité notifié, DRH pour information) → AVIS du chef d'unité
 * (favorable, ou défavorable motivé ; réputé favorable passé 48 heures ouvrées, paramètre ; alerte
 * au chef 12 heures ouvrées avant) → DÉCISION du DRH (approuvée, ou refusée avec motif). Le motif
 * médical n'est visible que du demandeur et du DRH (§3.2), et le DRH ne le lit qu'après
 * réauthentification. Le solde n'est décompté qu'à l'approbation, rendu à l'annulation.
 */
@Injectable()
export class LeaveRequestsService {
  private readonly logger = new Logger('Conges');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly medicalPrivacy: LeaveMedicalPrivacyService,
    private readonly parametres: ParametresService,
    private readonly taches: TachesPlanifieesService,
    private readonly preuves: PreuveIdentiteService,
  ) {}

  // ------------------------------------------------------------------ acteurs du circuit

  /** Chef(s) d'unité qui donnent l'avis : le chef le plus proche ; DN/DNA seulement à défaut. */
  private async avisants(target: LeaveRequestWithUser['user']): Promise<string[]> {
    const validateurs = await this.prisma.user.findMany({
      where: { AND: [this.cascade.getUsersWithDirectAuthorityOverWhere(target), { status: UserStatus.ACTIF }] },
      select: { id: true, role: true },
    });
    const proches = validateurs.filter((v) => !this.cascade.isLeadershipRole(v.role) && v.id !== target.id);
    return (proches.length ? proches : validateurs.filter((v) => v.id !== target.id)).map((v) => v.id);
  }

  private async peutDonnerAvis(actor: AuthenticatedUser, r: LeaveRequestWithUser): Promise<boolean> {
    if (r.userId === actor.id || !this.cascade.hasDirectAuthorityOver(actor, r.user)) return false;
    if (!this.cascade.isLeadershipRole(actor.role)) return true;
    return !(await this.medicalPrivacy.hasCloserValidator(r.user));
  }

  /** Décideur : le DRH ; pour la demande d'un titulaire du rôle DRH, le DN ou la DNA. */
  private async peutDecider(actor: AuthenticatedUser, r: LeaveRequestWithUser): Promise<boolean> {
    if (r.userId === actor.id) return false;
    const demandeurDrh = (await this.prisma.user.count({ where: { id: r.userId, ...detenteursWhere(RoleFonctionnel.DRH) } })) > 0;
    if (demandeurDrh) return actor.role === SystemRole.DN || actor.role === SystemRole.DNA;
    return estDrh(actor);
  }

  private async idsDecideurs(r: LeaveRequestWithUser): Promise<string[]> {
    const drh = (await this.prisma.user.findMany({ where: detenteursWhere(RoleFonctionnel.DRH), select: { id: true } })).map((u) => u.id).filter((id) => id !== r.userId);
    if (drh.length) return drh;
    return (await this.prisma.user.findMany({ where: { role: { in: [SystemRole.DN, SystemRole.DNA] }, status: UserStatus.ACTIF }, select: { id: true } })).map((u) => u.id);
  }

  private etape(r: LeaveRequestWithUser): EtapeConge {
    if (r.status === LeaveRequestStatus.APPROUVEE) return 'APPROUVEE';
    if (r.status === LeaveRequestStatus.REJETEE) return 'REFUSEE';
    if (r.status === LeaveRequestStatus.ANNULEE) return 'ANNULEE';
    return r.avisEtat ? 'DECISION_ATTENDUE' : 'AVIS_ATTENDU';
  }

  private async vue(actor: AuthenticatedUser, r: LeaveRequestWithUser, noms?: Map<string, string>): Promise<LeaveRequestView> {
    const medical = this.medicalPrivacy.isSensitiveCode(r.leaveType.code);
    const soi = r.userId === actor.id;
    const drh = estDrh(actor);
    const masquerType = medical && !soi && !drh;
    // Le DRH voit le type pour décider ; le motif médical libre reste derrière la réauthentification.
    const motifVerrouille = medical && !soi && drh && !!r.reason && !(await this.preuves.estValide(actor));
    const enAttente = r.status === LeaveRequestStatus.EN_ATTENTE;
    const nomAvis = r.avisParId ? noms?.get(r.avisParId) ?? (await this.nom(r.avisParId)) : null;
    return {
      ...r,
      ...(masquerType ? { leaveTypeId: null, leaveType: this.medicalPrivacy.maskedLeaveType(), reason: null } : {}),
      ...(motifVerrouille ? { reason: null } : {}),
      etape: this.etape(r),
      motifVerrouille,
      avisPar: r.avisParId && nomAvis ? { id: r.avisParId, nom: nomAvis } : null,
      droits: {
        peutDonnerAvis: enAttente && !r.avisEtat && (await this.peutDonnerAvis(actor, r)),
        peutDecider: enAttente && !!r.avisEtat && (await this.peutDecider(actor, r)),
        peutAnnuler: (r.status === LeaveRequestStatus.EN_ATTENTE || r.status === LeaveRequestStatus.APPROUVEE) && (soi || this.cascade.hasDirectAuthorityOver(actor, r.user)),
      },
    };
  }

  private async nom(id: string): Promise<string | null> {
    const u = await this.prisma.user.findUnique({ where: { id }, select: { firstName: true, lastName: true } });
    return u ? `${u.firstName} ${u.lastName}` : null;
  }

  // ------------------------------------------------------------------ demande

  async create(actor: AuthenticatedUser, dto: CreateLeaveRequestDto): Promise<LeaveRequestView> {
    const leaveType = await this.prisma.leaveType.findUnique({ where: { id: dto.leaveTypeId } });
    if (!leaveType) throw new NotFoundException('Type de congé introuvable');
    const isSensitive = this.medicalPrivacy.isSensitiveCode(leaveType.code);

    const startDate = new Date(dto.startDate);
    const endDate = new Date(dto.endDate);
    if (endDate < startDate) {
      throw new BadRequestException('La date de fin ne peut pas être antérieure à la date de début.');
    }
    const daysCount = Math.floor((endDate.getTime() - startDate.getTime()) / MS_PER_DAY) + 1;
    const delai = await this.parametres.valeur('conges.delaiAvisHeures');

    const leaveRequest = await this.prisma.leaveRequest.create({
      data: { userId: actor.id, leaveTypeId: dto.leaveTypeId, startDate, endDate, daysCount, reason: dto.reason, avisEcheance: ajouterHeuresOuvrees(new Date(), delai) },
      select: LEAVE_REQUEST_SELECT,
    });

    // Le motif médical n'a pas sa place dans le journal d'audit (besoin d'en connaître).
    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'LeaveRequest',
      entityId: leaveRequest.id,
      metadata: { leaveType: isSensitive ? 'PROTEGE' : leaveType.code, startDate: dto.startDate, endDate: dto.endDate, daysCount },
    });

    const qui = `${leaveRequest.user.firstName} ${leaveRequest.user.lastName}`;
    const duree = `${daysCount} jour${daysCount > 1 ? 's' : ''}`;
    const echeance = leaveRequest.avisEcheance!.toISOString().slice(0, 16).replace('T', ' ');
    // Chef d'unité : avis attendu ; le type médical n'apparaît jamais hors DRH.
    for (const id of await this.avisants(leaveRequest.user)) {
      await this.notifications.notify(
        id,
        NotificationType.CONGE_SOUMIS,
        'Demande de congé : votre avis est attendu',
        `${qui} — ${isSensitive ? 'Absence' : leaveType.name}, ${duree}. Avis attendu avant le ${echeance} UTC ; passé ce délai, il sera réputé favorable.`,
        `/leaves?id=${leaveRequest.id}`,
        qui,
        { libelleBouton: 'Donner mon avis' },
      );
    }
    // DRH : pour information (§A6.1).
    for (const id of await this.idsDecideurs(leaveRequest)) {
      await this.notifications.notify(id, NotificationType.CONGE_SOUMIS, 'Nouvelle demande de congé (pour information)', `${qui} — ${leaveType.name}, ${duree}. Avis du chef attendu, puis votre décision.`, `/leaves?id=${leaveRequest.id}`, qui);
    }
    return this.vue(actor, leaveRequest);
  }

  /** Mes demandes, celles de mon périmètre (chefs, DN/DNA) ; toutes pour le DRH (il décide). */
  async findAllVisibleTo(actor: AuthenticatedUser, filters: LeaveRequestFiltersDto): Promise<LeaveRequestView[]> {
    const requests = await this.prisma.leaveRequest.findMany({
      where: {
        ...(estDrh(actor) ? {} : { user: this.cascade.getVisibleUserWhereForLeadershipScope(actor) }),
        status: filters.status,
        userId: filters.userId,
        leaveTypeId: filters.leaveTypeId,
        startDate: filters.year ? { gte: new Date(filters.year, 0, 1), lt: new Date(filters.year + 1, 0, 1) } : undefined,
      },
      select: LEAVE_REQUEST_SELECT,
      orderBy: { createdAt: 'desc' },
    });
    const ids = [...new Set(requests.map((r) => r.avisParId).filter((x): x is string => !!x))];
    const noms = new Map((await this.prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, firstName: true, lastName: true } })).map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
    return Promise.all(requests.map((r) => this.vue(actor, r, noms)));
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<LeaveRequestView> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    if (leaveRequest.userId !== actor.id && !estDrh(actor) && !this.cascade.hasDirectAuthorityOver(actor, leaveRequest.user)) {
      throw new ForbiddenException('Cette demande de congé est hors de votre périmètre.');
    }
    const v = await this.vue(actor, leaveRequest);
    if (this.medicalPrivacy.isSensitiveCode(leaveRequest.leaveType.code) && estDrh(actor) && leaveRequest.userId !== actor.id && !v.motifVerrouille && leaveRequest.reason) {
      await this.preuves.tracerAcces(actor, 'LeaveRequest', id, 'Motif médical d’une absence');
    }
    return v;
  }

  // ------------------------------------------------------------------ avis du chef

  async donnerAvis(actor: AuthenticatedUser, id: string, dto: AvisLeaveRequestDto): Promise<LeaveRequestView> {
    const r = await this.getLeaveRequestOrThrow(id);
    if (!(await this.peutDonnerAvis(actor, r))) throw new ForbiddenException('L’avis revient au chef d’unité de la personne.');
    if (r.status !== LeaveRequestStatus.EN_ATTENTE) throw new ConflictException('Cette demande n’attend plus d’avis.');
    if (r.avisEtat) throw new ConflictException(r.avisEtat === 'TACITE' ? 'Le délai d’avis est dépassé : l’avis a été réputé favorable.' : 'L’avis a déjà été donné.');
    const motif = dto.motif?.trim() || null;
    if (dto.avis === 'DEFAVORABLE' && !motif) throw new BadRequestException('Un avis défavorable doit être motivé.');
    // Mise à jour conditionnelle : deux avis simultanés (ou l'avis tacite) ne s'écrasent pas.
    const n = await this.prisma.leaveRequest.updateMany({
      where: { id, status: LeaveRequestStatus.EN_ATTENTE, avisEtat: null },
      data: { avisEtat: dto.avis, avisParId: actor.id, avisMotif: motif, avisLe: new Date() },
    });
    if (n.count === 0) throw new ConflictException('L’avis a déjà été donné.');
    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'LeaveRequest', entityId: id, metadata: { event: 'avis_conge', avis: dto.avis, motif } });
    const maj = await this.getLeaveRequestOrThrow(id);
    await this.notifierDecideurs(maj, `Avis ${dto.avis === 'FAVORABLE' ? 'favorable' : 'défavorable'} du chef${motif ? ` : « ${motif} »` : ''}. Votre décision est attendue.`);
    return this.vue(actor, maj);
  }

  private async notifierDecideurs(r: LeaveRequestWithUser, texte: string): Promise<void> {
    const qui = `${r.user.firstName} ${r.user.lastName}`;
    for (const id of await this.idsDecideurs(r)) {
      await this.notifications.notify(id, NotificationType.CONGE_SOUMIS, 'Congé : décision attendue', `${qui} — ${r.leaveType.name}, du ${r.startDate.toISOString().slice(0, 10)} au ${r.endDate.toISOString().slice(0, 10)}. ${texte}`, `/leaves?id=${r.id}`, qui, { libelleBouton: 'Décider' });
    }
  }

  // ------------------------------------------------------------------ décision du DRH

  private async exigerDecideur(actor: AuthenticatedUser, r: LeaveRequestWithUser): Promise<void> {
    if (!(await this.peutDecider(actor, r))) throw new ForbiddenException('La décision revient au DRH (au DN ou à la DNA pour une demande du DRH).');
    this.assertPending(r);
    if (!r.avisEtat) throw new ConflictException('L’avis du chef d’unité est attendu avant la décision.');
  }

  async approve(actor: AuthenticatedUser, id: string, dto: DecideLeaveRequestDto): Promise<LeaveRequestView> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    await this.exigerDecideur(actor, leaveRequest);

    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({
        where: { id },
        data: { status: LeaveRequestStatus.APPROUVEE, approverId: actor.id, decisionComment: dto.comment, decidedAt: new Date() },
        select: LEAVE_REQUEST_SELECT,
      });
      const year = result.startDate.getFullYear();
      await tx.leaveBalance.upsert({
        where: { userId_leaveTypeId_year: { userId: result.userId, leaveTypeId: result.leaveTypeId, year } },
        update: { usedDays: { increment: result.daysCount } },
        create: { userId: result.userId, leaveTypeId: result.leaveTypeId, year, totalDays: 0, usedDays: result.daysCount },
      });
      return result;
    });

    await this.audit.log({ actorId: actor.id, action: AuditAction.VALIDATION, entityType: 'LeaveRequest', entityId: id, metadata: { daysCount: updated.daysCount } });
    await this.notifications.notify(updated.userId, NotificationType.CONGE_VALIDE, 'Demande de congé approuvée', `${updated.leaveType.name} — ${updated.daysCount} jour${updated.daysCount > 1 ? 's' : ''}`, `/leaves?id=${id}`, updated.leaveType.name);
    // Chef d'unité informé de la décision (sans type médical).
    const medical = this.medicalPrivacy.isSensitiveCode(updated.leaveType.code);
    for (const chef of await this.avisants(updated.user)) {
      await this.notifications.notify(chef, NotificationType.CONGE_VALIDE, 'Congé approuvé par le DRH', `${updated.user.firstName} ${updated.user.lastName} — ${medical ? 'Absence' : updated.leaveType.name}, du ${updated.startDate.toISOString().slice(0, 10)} au ${updated.endDate.toISOString().slice(0, 10)}.`, `/leaves?id=${id}`);
    }
    return this.vue(actor, updated);
  }

  async reject(actor: AuthenticatedUser, id: string, dto: RejectLeaveRequestDto): Promise<LeaveRequestView> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    await this.exigerDecideur(actor, leaveRequest);
    const updated = await this.prisma.leaveRequest.update({
      where: { id },
      data: { status: LeaveRequestStatus.REJETEE, approverId: actor.id, decisionComment: dto.comment, decidedAt: new Date() },
      select: LEAVE_REQUEST_SELECT,
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.REJET, entityType: 'LeaveRequest', entityId: id, metadata: { comment: dto.comment } });
    await this.notifications.notify(updated.userId, NotificationType.CONGE_REJETE, 'Demande de congé refusée', dto.comment, `/leaves?id=${id}`, updated.leaveType.name);
    return this.vue(actor, updated);
  }

  /** Par le demandeur ou son supérieur cascade. Recrédite le solde si la demande était déjà approuvée. */
  async cancel(actor: AuthenticatedUser, id: string): Promise<LeaveRequestView> {
    const leaveRequest = await this.getLeaveRequestOrThrow(id);
    const isRequester = leaveRequest.userId === actor.id;
    if (!isRequester && !this.cascade.hasDirectAuthorityOver(actor, leaveRequest.user)) {
      throw new ForbiddenException("Vous n'avez pas l'autorité pour annuler cette demande.");
    }
    if (leaveRequest.status !== LeaveRequestStatus.EN_ATTENTE && leaveRequest.status !== LeaveRequestStatus.APPROUVEE) {
      throw new ConflictException('Seule une demande en attente ou approuvée peut être annulée.');
    }
    const wasApproved = leaveRequest.status === LeaveRequestStatus.APPROUVEE;
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.leaveRequest.update({ where: { id }, data: { status: LeaveRequestStatus.ANNULEE }, select: LEAVE_REQUEST_SELECT });
      if (wasApproved) {
        const year = result.startDate.getFullYear();
        await tx.leaveBalance.updateMany({ where: { userId: result.userId, leaveTypeId: result.leaveTypeId, year }, data: { usedDays: { decrement: result.daysCount } } });
      }
      return result;
    });
    await this.audit.log({ actorId: actor.id, action: AuditAction.MODIFICATION, entityType: 'LeaveRequest', entityId: id, metadata: { event: 'leave_cancelled', refunded: wasApproved } });
    return this.vue(actor, updated);
  }

  // ------------------------------------------------------------------ échéances (tâche planifiée)

  @Cron('*/15 * * * *')
  async echeancesPeriodiques(): Promise<void> {
    await this.taches.suivre('avis-conges', () => this.executer(new Date())).catch((e) => this.logger.error(`Avis des congés : ${e instanceof Error ? e.message : e}`));
  }

  /**
   * Appelable avec une date simulée : (1) reprise — échéance posée pour les demandes en attente
   * d'avant N3 ; (2) alerte au chef 12 heures ouvrées avant l'échéance, une fois ; (3) passé
   * l'échéance, avis réputé favorable (TACITE) et DRH notifié.
   */
  async executer(maintenant: Date): Promise<{ echeancesPosees: number; alertes: number; tacites: number }> {
    const bilan = { echeancesPosees: 0, alertes: 0, tacites: 0 };
    const delai = await this.parametres.valeur('conges.delaiAvisHeures');
    const sansEcheance = await this.prisma.leaveRequest.findMany({ where: { status: LeaveRequestStatus.EN_ATTENTE, avisEtat: null, avisEcheance: null }, select: { id: true } });
    for (const r of sansEcheance) {
      await this.prisma.leaveRequest.update({ where: { id: r.id }, data: { avisEcheance: ajouterHeuresOuvrees(maintenant, delai) } });
      bilan.echeancesPosees++;
    }
    const attente = await this.prisma.leaveRequest.findMany({ where: { status: LeaveRequestStatus.EN_ATTENTE, avisEtat: null, avisEcheance: { not: null } }, select: LEAVE_REQUEST_SELECT });
    for (const r of attente) {
      const qui = `${r.user.firstName} ${r.user.lastName}`;
      if (maintenant >= r.avisEcheance!) {
        const n = await this.prisma.leaveRequest.updateMany({ where: { id: r.id, avisEtat: null, status: LeaveRequestStatus.EN_ATTENTE }, data: { avisEtat: 'TACITE', avisLe: maintenant } });
        if (!n.count) continue;
        await this.audit.log({ actorId: null, action: AuditAction.VALIDATION, entityType: 'LeaveRequest', entityId: r.id, metadata: { event: 'avis_conge', avis: 'TACITE' } });
        await this.notifierDecideurs(r, 'Sans avis du chef dans le délai, l’avis est réputé favorable.');
        bilan.tacites++;
      } else if (!r.alerteAvisAt && heuresOuvreesEntre(maintenant, r.avisEcheance!) <= ALERTE_AVIS_HEURES) {
        await this.prisma.leaveRequest.update({ where: { id: r.id }, data: { alerteAvisAt: maintenant } });
        const medical = this.medicalPrivacy.isSensitiveCode(r.leaveType.code);
        for (const id of await this.avisants(r.user)) {
          await this.notifications.notify(id, NotificationType.CONGE_SOUMIS, 'Rappel : avis attendu sur un congé', `${qui} — ${medical ? 'Absence' : r.leaveType.name}. Sans avis de votre part avant le ${r.avisEcheance!.toISOString().slice(0, 16).replace('T', ' ')} UTC, il sera réputé favorable.`, `/leaves?id=${r.id}`, qui, { libelleBouton: 'Donner mon avis' });
        }
        bilan.alertes++;
      }
    }
    return bilan;
  }

  private async getLeaveRequestOrThrow(id: string): Promise<LeaveRequestWithUser> {
    const leaveRequest = await this.prisma.leaveRequest.findUnique({ where: { id }, select: LEAVE_REQUEST_SELECT });
    if (!leaveRequest) throw new NotFoundException('Demande de congé introuvable');
    return leaveRequest;
  }

  private assertPending(leaveRequest: LeaveRequestWithUser): void {
    if (leaveRequest.status !== LeaveRequestStatus.EN_ATTENTE) {
      throw new ConflictException('Seule une demande en attente peut être approuvée ou refusée.');
    }
  }
}
