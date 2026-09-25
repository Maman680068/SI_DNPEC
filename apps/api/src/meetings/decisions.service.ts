import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { AuditAction, DecisionStatus, NotificationType, Prisma, UserStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { MeetingsService } from './meetings.service';
import { CreateDecisionDto } from './dto/create-decision.dto';
import { UpdateDecisionDto } from './dto/update-decision.dto';
import { ConvertDecisionDto } from './dto/convert-decision.dto';

const DECISION_SELECT = {
  id: true,
  meetingId: true,
  content: true,
  status: true,
  closedAt: true,
  closedById: true,
  createdById: true,
  createdAt: true,
  updatedAt: true,
  action: { select: { id: true, title: true, status: true, dueDate: true } },
} satisfies Prisma.DecisionSelect;

type DecisionWithAction = Prisma.DecisionGetPayload<{ select: typeof DECISION_SELECT }>;

/**
 * Décisions et actions de réunion (D2). Visibilité entièrement héritée de la
 * réunion (MeetingsService.getMeetingVisibilityWhere, réutilisée telle
 * quelle — jamais dupliquée ici, voir schema.prisma pour le principe).
 *
 * Gestion (créer/modifier/convertir/clôturer) réservée à l'organisateur de
 * la réunion — le "président de séance" (pas de champ dédié, décision de
 * conception D2). DN/DNA et la hiérarchie qui voient une décision par
 * cascade ne peuvent que consulter (findAllForMeeting, dashboard) et
 * relancer (remind) : voir n'est pas gérer, même principe qu'ailleurs dans
 * l'application (ex. Chef de Division en lecture seule sur le niveau 1 du
 * Dossier du personnel).
 *
 * Volontairement aucune dépendance vers TasksService pour la conversion en
 * action (Prisma.task.create direct) : TasksModule doit pouvoir importer
 * MeetingsModule pour le hook de clôture automatique (voir
 * TasksService.validate) sans créer de cycle — les deux services touchent
 * directement les tables Task/Decision là où c'est strictement nécessaire,
 * plutôt que de se dépendre mutuellement.
 */
@Injectable()
export class DecisionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
    private readonly meetings: MeetingsService,
  ) {}

  /** Relevé de décisions d'une réunion, avec les actions possibles de
   * l'acteur (l'écran n'en calcule aucune ; chaque action revérifie). */
  async findAllForMeeting(actor: AuthenticatedUser, meetingId: string) {
    await this.meetings.findOneVisibleTo(actor, meetingId); // 404 si hors périmètre
    const meeting = await this.getMeetingOrThrow(meetingId);
    const organisateur = this.cascade.isActingFor(actor, meeting.createdById);
    const decisions = await this.prisma.decision.findMany({
      where: { meetingId },
      select: DECISION_SELECT,
      orderBy: { createdAt: 'asc' },
    });
    return {
      peutAjouter: organisateur,
      decisions: decisions.map((d) => {
        const ouverte = d.status !== DecisionStatus.CLOTUREE;
        return {
          ...d,
          droits: {
            modifier: organisateur && ouverte,
            convertir: organisateur && ouverte && !d.action,
            cloturer: organisateur && ouverte,
            // « Relancer » : la hiérarchie qui voit la décision sans l'organiser.
            relancer: !organisateur && ouverte,
          },
        };
      }),
    };
  }

  /** Personnes que convertToAction accepterait comme responsable : mêmes
   * préconditions et même critère (une seule implémentation). */
  async responsablesPossibles(actor: AuthenticatedUser, decisionId: string) {
    const decision = await this.getDecisionOrThrow(decisionId);
    this.assertPeutConvertir(actor, decision);
    const actifs = await this.prisma.user.findMany({
      where: { status: UserStatus.ACTIF },
      select: { id: true, firstName: true, lastName: true, role: true, jobTitle: true, divisionId: true, sectionId: true, celluleId: true, status: true },
      orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    });
    return actifs
      .filter((u) => this.refusResponsable(actor, u) === null)
      .map(({ id, firstName, lastName, role, jobTitle }) => ({ id, firstName, lastName, role, jobTitle }));
  }

  private assertPeutConvertir(actor: AuthenticatedUser, decision: { status: DecisionStatus; action: unknown; meeting: { createdById: string } }): void {
    this.assertIsOrganizer(actor, decision.meeting);
    this.assertNotClosed(decision);
    if (decision.action) {
      throw new ConflictException('Cette décision a déjà une action associée.');
    }
  }

  /** Critère sur le responsable d'une action (null si accepté). Même règle
   * que TasksService.assertCanAssignAll : soi-même sans autorité, un tiers
   * seulement avec autorité hiérarchique directe. */
  private refusResponsable(
    actor: AuthenticatedUser,
    u: { id: string; status: UserStatus; divisionId: string | null; sectionId: string | null; celluleId: string | null },
  ): Error | null {
    if (u.status !== UserStatus.ACTIF) return new ForbiddenException("Le responsable désigné n'a pas de compte actif.");
    if (u.id !== actor.id && !this.cascade.hasDirectAuthorityOver(actor, u)) {
      return new ForbiddenException('Vous ne pouvez désigner comme responsable qu’une personne de votre périmètre (ou vous-même).');
    }
    return null;
  }

  async create(actor: AuthenticatedUser, meetingId: string, dto: CreateDecisionDto): Promise<DecisionWithAction> {
    const meeting = await this.getMeetingOrThrow(meetingId);
    this.assertIsOrganizer(actor, meeting);

    const decision = await this.prisma.decision.create({
      data: { meetingId, content: dto.content, createdById: actor.id },
      select: DECISION_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Decision',
      entityId: decision.id,
      metadata: { meetingId },
    });

    return decision;
  }

  async update(actor: AuthenticatedUser, decisionId: string, dto: UpdateDecisionDto): Promise<DecisionWithAction> {
    const decision = await this.getDecisionOrThrow(decisionId);
    this.assertIsOrganizer(actor, decision.meeting);
    this.assertNotClosed(decision);

    const updated = await this.prisma.decision.update({
      where: { id: decisionId },
      data: { content: dto.content },
      select: DECISION_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Decision',
      entityId: decisionId,
      metadata: { event: 'content_updated' },
    });

    return updated;
  }

  /** "Convertir en action" — crée la Task liée (responsable + échéance
   * obligatoires, voir ConvertDecisionDto). Une décision n'a jamais plus
   * d'une action (Task.sourceDecisionId est @unique côté schéma). */
  async convertToAction(
    actor: AuthenticatedUser,
    decisionId: string,
    dto: ConvertDecisionDto,
  ): Promise<DecisionWithAction> {
    const decision = await this.getDecisionOrThrow(decisionId);
    this.assertPeutConvertir(actor, decision);

    const assignee = await this.prisma.user.findUnique({
      where: { id: dto.assigneeId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true, status: true },
    });
    if (!assignee) throw new NotFoundException('Responsable introuvable');
    const refus = this.refusResponsable(actor, assignee);
    if (refus) throw refus;

    // Rattachement de la tâche à l'unité du responsable désigné, pour que la
    // cascade (Chef de Section/Division/Cellule de l'assigné) la voie comme
    // n'importe quelle tâche de son périmètre. Assigné sans unité (DN/DNA,
    // Assistant) : tâche sans rattachement, comme avant.
    //
    // Double-clic / requêtes concurrentes : le contrôle `decision.action`
    // ci-dessus ne suffit pas (deux requêtes peuvent le passer ensemble) —
    // Task.sourceDecisionId est @unique, la seconde création échoue en P2002,
    // traduite ici en 409 explicite. Rien n'est audité ni notifié dans ce cas.
    let task: { id: string; title: string };
    try {
      task = await this.prisma.task.create({
        data: {
          title: dto.title?.trim() || decision.content.slice(0, 300),
          description: dto.description,
          dueDate: new Date(dto.dueDate),
          createdById: actor.id,
          sourceDecisionId: decision.id,
          divisionId: assignee.divisionId,
          sectionId: assignee.sectionId,
          celluleId: assignee.celluleId,
          assignees: { create: [{ userId: dto.assigneeId }] },
        },
        select: { id: true, title: true },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cette décision a déjà une action associée.');
      }
      throw error;
    }

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Task',
      entityId: task.id,
      metadata: { sourceDecisionId: decision.id, title: task.title },
    });

    if (dto.assigneeId !== actor.id) {
      await this.notifications.notify(
        dto.assigneeId,
        NotificationType.TACHE_ASSIGNEE,
        'Nouvelle tâche assignée',
        task.title,
        `/tasks/${task.id}`,
        task.title,
      );
    }

    return this.getDecisionOrThrow(decisionId);
  }

  /** Clôture manuelle — utile pour une décision sans action (rien à convertir,
   * juste actée). La clôture automatique à la complétion de l'action liée
   * vit dans TasksService.validate, pas ici (voir schema.prisma). */
  async close(actor: AuthenticatedUser, decisionId: string): Promise<DecisionWithAction> {
    const decision = await this.getDecisionOrThrow(decisionId);
    this.assertIsOrganizer(actor, decision.meeting);
    this.assertNotClosed(decision);

    const updated = await this.prisma.decision.update({
      where: { id: decisionId },
      data: { status: DecisionStatus.CLOTUREE, closedAt: new Date(), closedById: actor.id },
      select: DECISION_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.VALIDATION,
      entityType: 'Decision',
      entityId: decisionId,
      metadata: { event: 'closed_manually' },
    });

    return updated;
  }

  /** "Relancer" — DN/hiérarchie qui voient la décision par cascade sans en être
   * l'organisateur : jamais d'action directe sur la décision (voir n'est pas
   * gérer), seulement notifier l'organisateur. */
  async remind(actor: AuthenticatedUser, decisionId: string): Promise<void> {
    const decision = await this.getDecisionOrThrow(decisionId);
    await this.meetings.findOneVisibleTo(actor, decision.meetingId); // 404 si hors périmètre
    this.assertNotClosed(decision);

    if (!this.cascade.isActingFor(actor, decision.meeting.createdById)) {
      await this.notifications.notify(
        decision.meeting.createdById,
        NotificationType.DECISION_RELANCE,
        'Relance sur une décision en attente',
        decision.content,
        `/reunions?id=${decision.meetingId}`,
      );
    }

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Decision',
      entityId: decisionId,
      metadata: { event: 'reminder_sent' },
    });
  }

  /**
   * Tableau de bord président/DN — même construction que
   * TasksService.dashboard() (RF-TAC-12) : compte les décisions non
   * exécutées dans le périmètre de visibilité de l'acteur. Pas de méthode
   * de cascade dédiée : président et DN/DNA obtiennent leur propre vue avec
   * exactement la même requête, seul l'acteur change (DN/DNA ont
   * hierarchyScope = {} dans getMeetingVisibilityWhere, donc voient déjà
   * tout).
   */
  async dashboard(actor: AuthenticatedUser) {
    const where: Prisma.DecisionWhereInput = {
      status: DecisionStatus.EN_ATTENTE,
      meeting: this.meetings.getMeetingVisibilityWhere(actor),
    };

    const [total, sansAction, enRetard] = await Promise.all([
      this.prisma.decision.count({ where }),
      this.prisma.decision.count({ where: { ...where, action: null } }),
      this.prisma.decision.count({ where: { ...where, action: { dueDate: { lt: new Date() } } } }),
    ]);

    return { total, sansAction, enRetard };
  }

  // --------------------------------------------------------------------

  private async getMeetingOrThrow(meetingId: string) {
    const meeting = await this.prisma.meeting.findUnique({ where: { id: meetingId } });
    if (!meeting) throw new NotFoundException('Réunion introuvable');
    return meeting;
  }

  private async getDecisionOrThrow(decisionId: string) {
    const decision = await this.prisma.decision.findUnique({
      where: { id: decisionId },
      select: { ...DECISION_SELECT, meeting: { select: { id: true, createdById: true } } },
    });
    if (!decision) throw new NotFoundException('Décision introuvable');
    return decision;
  }

  /** Suppléance/intérim (§2.6) : isActingFor accepte aussi bien l'organisateur
   * réel que son suppléant en fonction (interimForId). */
  private assertIsOrganizer(actor: AuthenticatedUser, meeting: { createdById: string }): void {
    if (!this.cascade.isActingFor(actor, meeting.createdById)) {
      throw new ForbiddenException('Seul l’organisateur de la réunion peut gérer ses décisions.');
    }
  }

  private assertNotClosed(decision: { status: DecisionStatus }): void {
    if (decision.status === DecisionStatus.CLOTUREE) {
      throw new ConflictException('Cette décision est déjà clôturée.');
    }
  }
}
