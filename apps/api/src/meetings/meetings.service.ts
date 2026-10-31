import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AuditAction, EtatDemandeReunion, MeetingResponseStatus, MeetingStatus, NotificationType, Prisma, SystemRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { RespondMeetingDto } from './dto/respond-meeting.dto';
import { CancelMeetingDto } from './dto/cancel-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';
import { ReservationCreee, ReservationsService } from '../logistique/reservations.service';
import { creeReunionDirectement } from './createurs';

// Délai avant le début d'une réunion auquel le rappel planifié se déclenche
// (voir sendDueReminders) — constante simple, pas de variable d'environnement
// tant qu'aucun besoin de le rendre configurable par déploiement.
const REMINDER_LEAD_MINUTES = 30;

const MEETING_SELECT = {
  id: true,
  title: true,
  agenda: true,
  location: true,
  startAt: true,
  endAt: true,
  status: true,
  cancelledAt: true,
  cancellationReason: true,
  minutesText: true,
  isOpen: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  participants: {
    select: { id: true, userId: true, responseStatus: true, respondedAt: true },
  },
  // D9 — salle réservée avec la réunion (statut visible : une éviction pour
  // priorité ou un refus laisse la réunion sans salle).
  reservation: { select: { id: true, statut: true, ressource: { select: { id: true, nom: true } } } },
  // S1 — réunion issue d'une demande validée : « Validée par … ».
  demandeReunion: { select: { id: true, decidePar: { select: { firstName: true, lastName: true } } } },
} satisfies Prisma.MeetingSelect;

type MeetingWithParticipants = Prisma.MeetingGetPayload<{ select: typeof MEETING_SELECT }>;

/**
 * Réunions (RF-CPL-03, §4.6) — calendrier partagé. Création directe : chefs, DN, DNA, assistants de
 * direction, DRH (`createurs.ts`) ; un chargé d'études (ou l'administrateur système) demande la réunion à
 * son chef (`DemandesReunionService`) et ne la crée qu'avec une demande acceptée, à usage unique, dont la
 * date et les participants validés s'imposent (S1).
 */
@Injectable()
export class MeetingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly reservations: ReservationsService,
  ) {}

  /**
   * Visibilité (§4.6) : organisateur et participants toujours, plus la
   * hiérarchie directe des participants en lecture seule — réutilise tel
   * quel CascadeService.getVisibleUserWhereForLeadershipScope (déjà le bon
   * filtre "utilisateurs dont je vois le contenu métier en cascade"),
   * jamais dupliqué ici. Aucune méthode de cascade dédiée aux réunions :
   * cette visibilité élargie ne donne aucune autorité d'action (voir
   * assertCanCancel plus bas, qui ignore délibérément ce périmètre).
   *
   * `isOpen` (D2) : exception explicite — une réunion déclarée ouverte est
   * visible à tout utilisateur authentifié. Non `private` : réutilisée telle
   * quelle par DecisionsService (même module), une décision héritant
   * entièrement de la visibilité de sa réunion (voir schema.prisma, Decision).
   */
  getMeetingVisibilityWhere(actor: AuthenticatedUser): Prisma.MeetingWhereInput {
    const hierarchyScope = this.cascade.getVisibleUserWhereForLeadershipScope(actor);
    return {
      OR: [
        { createdById: actor.id },
        { participants: { some: { userId: actor.id } } },
        { participants: { some: { user: hierarchyScope } } },
        { isOpen: true },
      ],
    };
  }

  async create(actor: AuthenticatedUser, dto: CreateMeetingDto): Promise<MeetingWithParticipants> {
    // S1 — demande acceptée : autorisation à usage unique du demandeur, date et participants verrouillés.
    let demandeId: string | null = null;
    if (dto.demandeReunionId) {
      const d = await this.prisma.demandeReunion.findUnique({ where: { id: dto.demandeReunionId } });
      if (!d) throw new NotFoundException('Demande de réunion introuvable');
      if (d.demandeurId !== actor.id || actor.interimForId) throw new ForbiddenException('Seul le demandeur crée la réunion de sa demande.');
      if (d.etat !== EtatDemandeReunion.ACCEPTEE || d.reunionId) throw new ConflictException('Cette autorisation a déjà servi ou la demande n’est pas acceptée.');
      if (d.debut.getTime() <= Date.now()) throw new ConflictException('L’autorisation a expiré : la date validée est passée.');
      demandeId = d.id;
      dto = { ...dto, startAt: d.debut.toISOString(), endAt: d.fin.toISOString(), participantIds: d.participantIds };
    } else if (!creeReunionDirectement(actor)) {
      throw new ForbiddenException('Demandez la réunion à votre chef : « Demander une réunion ».');
    }
    const startAt = new Date(dto.startAt);
    const endAt = dto.endAt ? new Date(dto.endAt) : undefined;
    if (endAt && endAt <= startAt) {
      throw new ForbiddenException('La fin de la réunion doit être après son début.');
    }

    const invitedIds = dto.participantIds.filter((id) => id !== actor.id);
    await this.assertParticipantsExist(invitedIds);

    if (dto.ressourceId && !endAt) {
      throw new BadRequestException('Indiquez l’heure de fin pour réserver une salle.');
    }

    // Réunion et réservation dans la même transaction : pas de réunion
    // créée si la salle est refusée (409/403), et inversement.
    const { meeting, reservation } = await this.prisma.$transaction(
      async (tx) => {
        const created = await tx.meeting.create({
          data: {
            title: dto.title,
            agenda: dto.agenda,
            location: dto.location,
            startAt,
            endAt,
            isOpen: dto.isOpen ?? false,
            createdById: actor.id,
            participants: {
              create: [
                // L'organisateur est toujours confirmé — il n'a pas à répondre à
                // sa propre invitation (voir schema.prisma, commentaire du modèle).
                { userId: actor.id, responseStatus: MeetingResponseStatus.CONFIRME, respondedAt: new Date() },
                ...invitedIds.map((userId) => ({ userId })),
              ],
            },
          },
          select: { id: true },
        });
        if (demandeId) {
          // Consommation conditionnelle : une seule réunion par autorisation, même en cas d'envoi double.
          const r = await tx.demandeReunion.updateMany({ where: { id: demandeId, etat: EtatDemandeReunion.ACCEPTEE, reunionId: null }, data: { etat: EtatDemandeReunion.UTILISEE, reunionId: created.id } });
          if (!r.count) throw new ConflictException('Cette autorisation a déjà servi.');
          await tx.etapeDemandeReunion.create({ data: { demandeId, action: 'REUNION_CREEE', parId: actor.id, versIds: [] } });
        }
        let res: ReservationCreee | null = null;
        if (dto.ressourceId) {
          res = await this.reservations.creerDansTransaction(tx, actor, {
            ressourceId: dto.ressourceId,
            debut: startAt.toISOString(),
            fin: endAt!.toISOString(),
            objet: `Réunion : ${dto.title}`,
            prioritaire: dto.prioritaire,
            meetingId: created.id,
          });
          await tx.meeting.update({ where: { id: created.id }, data: { location: res.ressource.nom } });
        }
        const full = await tx.meeting.findUniqueOrThrow({ where: { id: created.id }, select: MEETING_SELECT });
        return { meeting: full, reservation: res };
      },
      { maxWait: 10_000, timeout: 20_000 },
    );
    if (reservation) await this.reservations.apresCreation(actor, reservation, `Réunion : ${dto.title}`);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Meeting',
      entityId: meeting.id,
      metadata: { title: meeting.title, startAt: meeting.startAt, participantIds: invitedIds },
    });

    if (invitedIds.length > 0) {
      await this.notifications.notifyMany(
        invitedIds,
        NotificationType.REUNION_PLANIFIEE,
        'Nouvelle réunion',
        `${meeting.title} — ${formatWhen(meeting.startAt)}`,
        `/reunions?id=${meeting.id}`,
        meeting.title,
      );
    }

    return meeting;
  }

  findAllVisibleTo(actor: AuthenticatedUser): Promise<MeetingWithParticipants[]> {
    return this.prisma.meeting.findMany({
      where: this.getMeetingVisibilityWhere(actor),
      select: MEETING_SELECT,
      orderBy: { startAt: 'asc' },
    });
  }

  /** Recherche transverse (socle N5) : mêmes règles de visibilité que l'écran des réunions. */
  rechercher(actor: AuthenticatedUser, q: string, take: number) {
    return this.prisma.meeting.findMany({
      where: { AND: [this.getMeetingVisibilityWhere(actor), { title: { contains: q, mode: 'insensitive' } }] },
      select: { id: true, title: true, startAt: true },
      orderBy: { startAt: 'desc' },
      take,
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<MeetingWithParticipants> {
    const meeting = await this.prisma.meeting.findFirst({
      where: { id, ...this.getMeetingVisibilityWhere(actor) },
      select: MEETING_SELECT,
    });
    if (!meeting) throw new NotFoundException('Réunion introuvable');
    return meeting;
  }

  /** Compte-rendu (D2) : texte narratif libre et déclaration "réunion ouverte" —
   * réservé à l'organisateur, comme cancel() (une réunion est un artefact
   * personnel d'agenda, pas du contenu métier délégué en cascade). */
  async update(actor: AuthenticatedUser, meetingId: string, dto: UpdateMeetingDto): Promise<MeetingWithParticipants> {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Réunion introuvable');
    if (!this.cascade.isActingFor(actor, meeting.createdById)) {
      throw new ForbiddenException("Seul l'organisateur peut modifier cette réunion.");
    }

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { minutesText: dto.minutesText, isOpen: dto.isOpen },
      select: MEETING_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Meeting',
      entityId: meetingId,
      metadata: { event: 'meeting_updated', fields: Object.keys(dto) },
    });

    return updated;
  }

  /** Accepter/décliner sa propre invitation — action en libre-service sur sa
   * propre ligne, sans lien avec l'autorité hiérarchique (comme cocher sa
   * propre sous-tâche, voir TasksService.toggleSubtaskCompletion). */
  async respond(actor: AuthenticatedUser, meetingId: string, dto: RespondMeetingDto): Promise<MeetingWithParticipants> {
    const participant = await this.prisma.meetingParticipant.findUnique({
      where: { meetingId_userId: { meetingId, userId: actor.id } },
    });
    if (!participant) {
      throw new NotFoundException("Vous n'êtes pas invité à cette réunion.");
    }

    await this.prisma.meetingParticipant.update({
      where: { id: participant.id },
      data: { responseStatus: dto.status, respondedAt: new Date() },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Meeting',
      entityId: meetingId,
      metadata: { event: 'meeting_response', status: dto.status },
    });

    return this.findOneVisibleTo(actor, meetingId);
  }

  /** Seul l'organisateur peut annuler — une réunion est un artefact personnel
   * d'agenda, pas du contenu métier délégué en cascade comme une tâche :
   * délibérément aucune autorité hiérarchique de substitution ici (voir
   * CascadeService.hasDirectAuthorityOver, non utilisé) — seule exception,
   * la suppléance/intérim (§4.10, CascadeService.isActingFor), une identité
   * explicitement empruntée pour la durée de la requête, pas une autorité
   * cascade implicite. */
  async cancel(actor: AuthenticatedUser, meetingId: string, dto: CancelMeetingDto): Promise<MeetingWithParticipants> {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: { participants: true },
    });
    if (!meeting) throw new NotFoundException('Réunion introuvable');
    if (!this.cascade.isActingFor(actor, meeting.createdById)) {
      throw new ForbiddenException("Seul l'organisateur peut annuler cette réunion.");
    }
    if (meeting.status === MeetingStatus.ANNULEE) {
      throw new ForbiddenException('Cette réunion est déjà annulée.');
    }

    await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { status: MeetingStatus.ANNULEE, cancelledAt: new Date(), cancellationReason: dto.reason },
    });
    // D9 — la salle réservée avec la réunion est libérée.
    await this.reservations.libererPourReunion(actor, meetingId);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Meeting',
      entityId: meetingId,
      metadata: { event: 'meeting_cancelled', reason: dto.reason ?? null },
    });

    const otherParticipantIds = meeting.participants.map((p) => p.userId).filter((id) => id !== actor.id);
    if (otherParticipantIds.length > 0) {
      await this.notifications.notifyMany(
        otherParticipantIds,
        NotificationType.REUNION_ANNULEE,
        'Réunion annulée',
        `${meeting.title} — ${formatWhen(meeting.startAt)}`,
        `/reunions?id=${meeting.id}`,
        meeting.title,
      );
    }

    return this.findOneVisibleTo(actor, meetingId);
  }

  /**
   * Rappel planifié (§4.6) : toutes les REMINDER_LEAD_MINUTES avant le début
   * d'une réunion, notifie tous ses participants une seule fois
   * (Meeting.reminderSentAt, jamais réinitialisé, évite le doublon entre deux
   * passages du job). Callable directement (pas seulement via @Cron) pour
   * être exercée par un test sans attendre la fenêtre réelle.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueReminders(): Promise<void> {
    const now = new Date();
    const dueBefore = new Date(now.getTime() + REMINDER_LEAD_MINUTES * 60_000);

    const dueMeetings = await this.prisma.meeting.findMany({
      where: {
        status: MeetingStatus.PLANIFIEE,
        reminderSentAt: null,
        startAt: { lte: dueBefore, gt: now },
      },
      include: { participants: true },
    });

    for (const meeting of dueMeetings) {
      const participantIds = meeting.participants.map((p) => p.userId);
      if (participantIds.length > 0) {
        await this.notifications.notifyMany(
          participantIds,
          NotificationType.REUNION_RAPPEL,
          'Rappel de réunion',
          `${meeting.title} — ${formatWhen(meeting.startAt)}`,
          `/reunions?id=${meeting.id}`,
          meeting.title,
        );
      }
      await this.prisma.meeting.update({ where: { id: meeting.id }, data: { reminderSentAt: now } });
      await this.audit.log({
        actorId: null,
        action: AuditAction.MODIFICATION,
        entityType: 'Meeting',
        entityId: meeting.id,
        metadata: { event: 'meeting_reminder_sent' },
      });
    }
  }

  private async assertParticipantsExist(userIds: string[]): Promise<void> {
    if (userIds.length === 0) return;
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, status: true, role: true },
    });
    if (users.length !== userIds.length) {
      throw new NotFoundException('Un ou plusieurs participants sont introuvables.');
    }
    if (users.some((u) => u.status !== UserStatus.ACTIF)) {
      throw new ForbiddenException('Un ou plusieurs participants n’ont pas de compte actif.');
    }
    // Stagiaire (D6) : le module Réunions ne lui est pas ouvert.
    if (users.some((u) => u.role === SystemRole.STAGIAIRE)) {
      throw new ForbiddenException('Un stagiaire n’a pas accès aux réunions : il ne peut pas y être invité.');
    }
  }
}

function formatWhen(date: Date): string {
  return date.toLocaleString('fr-FR', { dateStyle: 'long', timeStyle: 'short' });
}
