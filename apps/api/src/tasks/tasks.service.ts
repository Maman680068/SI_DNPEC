import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  AuditAction,
  DecisionStatus,
  NotificationType,
  Prisma,
  RecurrenceFrequency,
  SystemRole,
  TaskAssigneeRole,
  TaskConfidentiality,
  TaskStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../common/audit/audit.service';
import { StorageService } from '../common/storage/storage.service';
import { CascadeService } from '../org/cascade/cascade.service';
import { NotificationsService } from '../communication/notifications/notifications.service';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { CreateTaskDto } from './dto/create-task.dto';
import { CreateTaskAssigneeDto } from './dto/create-task-assignee.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { UpdateProgressDto } from './dto/update-progress.dto';
import { RejectTaskDto } from './dto/reject-task.dto';
import { ValidateTaskDto } from './dto/validate-task.dto';
import { TaskFiltersDto } from './dto/task-filters.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { BroadcastMode, BroadcastTaskDto } from './dto/broadcast-task.dto';
import { CreateSavedFilterDto } from './dto/create-saved-filter.dto';

const TASK_SELECT = {
  id: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  confidentiality: true,
  dueDate: true,
  documentRequired: true,
  divisionId: true,
  sectionId: true,
  celluleId: true,
  projectId: true,
  parentTaskId: true,
  progressPercent: true,
  isRecurring: true,
  recurrenceFrequency: true,
  recurrenceEndDate: true,
  recurrenceSourceId: true,
  createdById: true,
  sourceDecisionId: true,
  submittedById: true,
  submittedAt: true,
  validatedById: true,
  validatedAt: true,
  validationComment: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  assignees: { select: { id: true, userId: true, roleOnTask: true, assignedAt: true } },
} satisfies Prisma.TaskSelect;

type TaskWithAssignees = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

type OrgAttachmentInput = {
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
};

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly cascade: CascadeService,
    private readonly notifications: NotificationsService,
  ) {}

  // --------------------------------------------------------------------
  // CRUD (RF-TAC-01, RF-TAC-06, RF-TAC-07)
  // --------------------------------------------------------------------

  async create(actor: AuthenticatedUser, dto: CreateTaskDto): Promise<TaskWithAssignees> {
    const confidentiality = dto.confidentiality ?? TaskConfidentiality.PUBLIC_INTERNE;
    this.cascade.assertCanSetTaskConfidentiality(actor, confidentiality);

    const orgAttachment: OrgAttachmentInput = {
      divisionId: dto.divisionId ?? null,
      sectionId: dto.sectionId ?? null,
      celluleId: dto.celluleId ?? null,
    };
    await this.assertOrgAttachmentValid(orgAttachment);
    if (dto.projectId) await this.assertProjectExists(dto.projectId);

    const assignees = dto.assignees ?? [];
    if (assignees.length > 0) {
      await this.assertCanAssignAll(actor, assignees.map((a) => a.userId));
    }

    const task = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        confidentiality,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        documentRequired: dto.documentRequired ?? false,
        ...orgAttachment,
        projectId: dto.projectId,
        isRecurring: !!dto.recurrenceFrequency,
        recurrenceFrequency: dto.recurrenceFrequency,
        recurrenceEndDate: dto.recurrenceEndDate ? new Date(dto.recurrenceEndDate) : undefined,
        createdById: actor.id,
        assignees: assignees.length
          ? {
              create: assignees.map((a) => ({
                userId: a.userId,
                roleOnTask: a.roleOnTask ?? TaskAssigneeRole.RESPONSABLE,
              })),
            }
          : undefined,
      },
      select: TASK_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Task',
      entityId: task.id,
      metadata: { title: task.title, confidentiality: task.confidentiality },
    });

    if (assignees.length > 0) {
      await this.notifications.notifyMany(
        assignees.map((a) => a.userId).filter((id) => id !== actor.id),
        NotificationType.TACHE_ASSIGNEE,
        'Nouvelle tâche assignée',
        task.title,
        `/tasks/${task.id}`,
        task.title,
      );
    }

    return task;
  }

  /**
   * Diffusion à une division (RF-TAC) : mode COLLECTIVE (une tâche, tous les
   * membres actifs en co-responsables) ou INDIVIDUAL (une tâche par membre,
   * statut indépendant pour chacune). Réutilise `create()` telle quelle plutôt
   * que de dupliquer la logique de création/notification/audit — un appel par
   * tâche créée. L'autorité (assertCanBroadcastToDivision) est vérifiée à
   * part, avant toute requête sur l'effectif : voir sa docstring pour
   * pourquoi une division vide ne doit jamais suffire à "prouver" une
   * autorité qu'on n'a pas.
   */
  async broadcastToDivision(actor: AuthenticatedUser, dto: BroadcastTaskDto): Promise<TaskWithAssignees[]> {
    this.cascade.assertCanBroadcastToDivision(actor, dto.divisionId);

    const division = await this.prisma.division.findUnique({ where: { id: dto.divisionId } });
    if (!division) throw new NotFoundException('Division introuvable');

    const members = await this.prisma.user.findMany({
      where: { divisionId: dto.divisionId, status: UserStatus.ACTIF, id: { not: actor.id } },
      select: { id: true },
    });
    if (members.length === 0) {
      throw new ConflictException('Cette division n’a aucun membre actif — impossible de diffuser une tâche.');
    }

    const base: Omit<CreateTaskDto, 'assignees'> = {
      title: dto.title,
      description: dto.description,
      priority: dto.priority,
      dueDate: dto.dueDate,
      divisionId: dto.divisionId,
      documentRequired: dto.documentRequired,
    };

    if (dto.mode === BroadcastMode.COLLECTIVE) {
      const task = await this.create(actor, { ...base, assignees: members.map((m) => ({ userId: m.id })) });
      return [task];
    }

    const tasks: TaskWithAssignees[] = [];
    for (const member of members) {
      tasks.push(await this.create(actor, { ...base, assignees: [{ userId: member.id }] }));
    }
    return tasks;
  }

  async findAllVisibleTo(actor: AuthenticatedUser, filters: TaskFiltersDto): Promise<TaskWithAssignees[]> {
    const dueDate: Prisma.DateTimeFilter | undefined =
      filters.dueBefore || filters.dueAfter
        ? {
            ...(filters.dueBefore ? { lte: new Date(filters.dueBefore) } : {}),
            ...(filters.dueAfter ? { gte: new Date(filters.dueAfter) } : {}),
          }
        : undefined;

    const where = this.scopedWhere(actor, {
      status: filters.status,
      priority: filters.priority,
      divisionId: filters.divisionId,
      sectionId: filters.sectionId,
      celluleId: filters.celluleId,
      projectId: filters.projectId,
      dueDate,
      assignees: filters.assigneeId ? { some: { userId: filters.assigneeId } } : undefined,
      parentTaskId: filters.includeSubtasks === 'true' ? undefined : null,
    });

    return this.prisma.task.findMany({
      where,
      select: TASK_SELECT,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOneVisibleTo(actor: AuthenticatedUser, id: string): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertVisible(actor, task);
    return task;
  }

  async update(actor: AuthenticatedUser, id: string, dto: UpdateTaskDto): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    await this.assertCanModify(actor, task);

    if (dto.confidentiality) {
      this.cascade.assertCanSetTaskConfidentiality(actor, dto.confidentiality);
    }

    const orgFieldsChanged =
      dto.divisionId !== undefined || dto.sectionId !== undefined || dto.celluleId !== undefined;
    const nextOrgAttachment: OrgAttachmentInput = {
      divisionId: dto.divisionId !== undefined ? dto.divisionId : task.divisionId,
      sectionId: dto.sectionId !== undefined ? dto.sectionId : task.sectionId,
      celluleId: dto.celluleId !== undefined ? dto.celluleId : task.celluleId,
    };
    if (orgFieldsChanged) await this.assertOrgAttachmentValid(nextOrgAttachment);
    if (dto.projectId) await this.assertProjectExists(dto.projectId);

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        confidentiality: dto.confidentiality,
        dueDate: dto.dueDate !== undefined ? (dto.dueDate ? new Date(dto.dueDate) : null) : undefined,
        projectId: dto.projectId,
        ...(orgFieldsChanged ? nextOrgAttachment : {}),
      },
      select: TASK_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Task',
      entityId: id,
      metadata: { event: 'task_updated', fields: Object.keys(dto) },
    });

    return updated;
  }

  async remove(actor: AuthenticatedUser, id: string): Promise<void> {
    const task = await this.getTaskOrThrow(id);
    await this.assertCanModify(actor, task);

    await this.prisma.task.delete({ where: { id } });
    if (task.parentTaskId) await this.recomputeParentProgress(task.parentTaskId);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SUPPRESSION,
      entityType: 'Task',
      entityId: id,
      metadata: { title: task.title },
    });
  }

  // --------------------------------------------------------------------
  // Sous-tâches (RF-TAC-04)
  // --------------------------------------------------------------------

  async createSubtask(actor: AuthenticatedUser, parentId: string, dto: CreateTaskDto): Promise<TaskWithAssignees> {
    const parent = await this.getTaskOrThrow(parentId);
    await this.assertCanModify(actor, parent);

    const confidentiality = dto.confidentiality ?? parent.confidentiality;
    this.cascade.assertCanSetTaskConfidentiality(actor, confidentiality);

    const orgAttachment: OrgAttachmentInput = {
      divisionId: dto.divisionId ?? parent.divisionId,
      sectionId: dto.sectionId ?? parent.sectionId,
      celluleId: dto.celluleId ?? parent.celluleId,
    };
    await this.assertOrgAttachmentValid(orgAttachment);

    const assignees = dto.assignees ?? [];
    if (assignees.length > 0) {
      await this.assertCanAssignAll(actor, assignees.map((a) => a.userId));
    }

    // dto.documentRequired est délibérément ignoré ici : une sous-tâche ne
    // passe jamais par SOUMISE_VALIDATION (voir toggleSubtaskCompletion), le
    // champ resterait sans effet — la colonne garde sa valeur par défaut.
    const subtask = await this.prisma.task.create({
      data: {
        title: dto.title,
        description: dto.description,
        priority: dto.priority,
        confidentiality,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        ...orgAttachment,
        projectId: parent.projectId,
        parentTaskId: parent.id,
        createdById: actor.id,
        assignees: assignees.length
          ? {
              create: assignees.map((a) => ({
                userId: a.userId,
                roleOnTask: a.roleOnTask ?? TaskAssigneeRole.RESPONSABLE,
              })),
            }
          : undefined,
      },
      select: TASK_SELECT,
    });

    await this.recomputeParentProgress(parent.id);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Task',
      entityId: subtask.id,
      metadata: { title: subtask.title, parentTaskId: parent.id },
    });

    if (assignees.length > 0) {
      await this.notifications.notifyMany(
        assignees.map((a) => a.userId).filter((id) => id !== actor.id),
        NotificationType.TACHE_ASSIGNEE,
        'Nouvelle sous-tâche assignée',
        subtask.title,
        `/tasks/${subtask.id}`,
        subtask.title,
      );
    }

    return subtask;
  }

  async listSubtasks(actor: AuthenticatedUser, parentId: string): Promise<TaskWithAssignees[]> {
    const parent = await this.findOneVisibleTo(actor, parentId);
    return this.prisma.task.findMany({
      where: { parentTaskId: parent.id },
      select: TASK_SELECT,
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bascule fait/pas fait d'une sous-tâche (À faire <-> Terminée) — délibérément
   * distinct du workflow à 4 états des tâches racines (§4.1) : "Soumise pour
   * validation" n'a pas de raison d'exister pour une case à cocher. Réservé aux
   * sous-tâches (task.parentTaskId non nul) ; une tâche racine garde start/submit/
   * validate/reject.
   */
  async toggleSubtaskCompletion(actor: AuthenticatedUser, id: string): Promise<TaskWithAssignees> {
    const subtask = await this.getTaskOrThrow(id);
    if (!subtask.parentTaskId) {
      throw new ConflictException(
        'Seules les sous-tâches se cochent directement — une tâche racine suit le workflow de validation (start/submit/validate/reject).',
      );
    }
    await this.assertCanToggleSubtask(actor, subtask);

    const nextStatus = subtask.status === TaskStatus.TERMINEE ? TaskStatus.A_FAIRE : TaskStatus.TERMINEE;
    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: nextStatus,
        completedAt: nextStatus === TaskStatus.TERMINEE ? new Date() : null,
        // Champs du workflow à 4 états sans objet pour une bascule directe.
        submittedById: null,
        submittedAt: null,
        validatedById: null,
        validatedAt: null,
        validationComment: null,
      },
      select: TASK_SELECT,
    });

    await this.recomputeParentProgress(subtask.parentTaskId);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Task',
      entityId: id,
      metadata: { event: 'subtask_toggled', from: subtask.status, to: nextStatus },
    });

    return updated;
  }

  // --------------------------------------------------------------------
  // Workflow de statut (§4.1) — actions explicites plutôt qu'un PATCH
  // status générique, pour appliquer une règle d'autorisation différente
  // à chaque transition. Réservé aux tâches racines — voir
  // toggleSubtaskCompletion pour les sous-tâches.
  // --------------------------------------------------------------------

  async start(actor: AuthenticatedUser, id: string): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertIsRootTask(task);
    this.assertIsCreatorOrAnyAssignee(actor, task);
    if (task.status !== TaskStatus.A_FAIRE) {
      throw new ConflictException('Cette tâche ne peut être démarrée que depuis le statut "À faire".');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.EN_COURS },
      select: TASK_SELECT,
    });
    await this.logStatusChange(actor, task.status, updated);
    return updated;
  }

  async submit(actor: AuthenticatedUser, id: string): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertIsRootTask(task);
    this.assertIsCreatorOrResponsable(actor, task);
    if (task.status !== TaskStatus.EN_COURS) {
      throw new ConflictException('Cette tâche ne peut être soumise que depuis le statut "En cours".');
    }
    if (task.documentRequired) {
      const attachmentCount = await this.prisma.taskAttachment.count({ where: { taskId: id } });
      if (attachmentCount === 0) {
        throw new ConflictException(
          'Cette tâche exige au moins une pièce jointe avant de pouvoir être soumise pour validation.',
        );
      }
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { status: TaskStatus.SOUMISE_VALIDATION, submittedById: actor.id, submittedAt: new Date() },
      select: TASK_SELECT,
    });
    await this.logStatusChange(actor, task.status, updated);

    if (task.createdById !== actor.id) {
      await this.notifications.notify(
        task.createdById,
        NotificationType.TACHE_SOUMISE_VALIDATION,
        'Tâche soumise pour validation',
        task.title,
        `/tasks/${id}`,
        task.title,
      );
    }

    return updated;
  }

  /**
   * Avancement manuel (RF-TAC) — uniquement pour une tâche SANS sous-tâche :
   * dès qu'il en existe au moins une, progressPercent est recalculé
   * automatiquement (recomputeParentProgress) et n'est plus modifiable ici.
   * Si toutes les sous-tâches sont ensuite supprimées, l'édition manuelle
   * redevient possible — les deux mécanismes ne coexistent jamais, l'un
   * prend le relais de l'autre selon l'effectif de sous-tâches à l'instant
   * considéré. Réservé au créateur ou à un Responsable assigné (pas un
   * simple Collaborateur) — même périmètre que la soumission pour
   * validation (assertIsCreatorOrResponsable) : les deux sont des
   * déclarations sur l'état d'avancement de la tâche, pas de simples
   * contributions.
   */
  async updateProgress(actor: AuthenticatedUser, id: string, dto: UpdateProgressDto): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertIsCreatorOrResponsable(actor, task);

    const subtaskCount = await this.prisma.task.count({ where: { parentTaskId: id } });
    if (subtaskCount > 0) {
      throw new ConflictException(
        'Le pourcentage se calcule automatiquement à partir des sous-tâches — retirez-les toutes pour le modifier manuellement.',
      );
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: { progressPercent: dto.progressPercent },
      select: TASK_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Task',
      entityId: id,
      metadata: { event: 'manual_progress', progressPercent: dto.progressPercent },
    });

    return updated;
  }

  /** Soumise → Terminée (§4.1 : traité comme un événement, pas un état de repos "Validée" — cf. maquette à 4 colonnes). */
  async validate(actor: AuthenticatedUser, id: string, dto: ValidateTaskDto): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertIsRootTask(task);
    const creator = await this.getCreatorOrgFields(task.createdById);
    this.cascade.assertHasDirectAuthorityOver(actor, creator);
    if (task.status !== TaskStatus.SOUMISE_VALIDATION) {
      throw new ConflictException('Seule une tâche "Soumise pour validation" peut être validée.');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.TERMINEE,
        validatedById: actor.id,
        validatedAt: new Date(),
        validationComment: dto.comment,
        completedAt: new Date(),
      },
      select: TASK_SELECT,
    });

    if (dto.comment) {
      await this.prisma.taskComment.create({
        data: { taskId: id, authorId: actor.id, body: `Validation : ${dto.comment}` },
      });
    }

    await this.logStatusChange(actor, task.status, updated, AuditAction.VALIDATION);

    await this.notifications.notifyMany(
      task.assignees.map((a) => a.userId).filter((id) => id !== actor.id),
      NotificationType.TACHE_VALIDEE,
      'Tâche validée',
      task.title,
      `/tasks/${id}`,
      task.title,
    );

    // D2 — clôture automatique de la décision de réunion à l'origine de cette
    // tâche (voir schema.prisma, Task.sourceDecisionId). Accès direct à la
    // table Decision plutôt qu'une dépendance vers MeetingsModule/
    // DecisionsService : évite un cycle (DecisionsService.convertToAction
    // crée des Task directement pour la même raison, voir sa docstring).
    // `updateMany` + condition de statut plutôt que `update` : idempotent si
    // rejoué, et sans effet si la décision a déjà été clôturée manuellement.
    if (updated.sourceDecisionId) {
      await this.prisma.decision.updateMany({
        where: { id: updated.sourceDecisionId, status: DecisionStatus.EN_ATTENTE },
        data: { status: DecisionStatus.CLOTUREE, closedAt: new Date(), closedById: actor.id },
      });
    }

    return updated;
  }

  /** Soumise → En cours (§4.1 : "Rejetée (retour en cours)" — événement, pas un état de repos). */
  async reject(actor: AuthenticatedUser, id: string, dto: RejectTaskDto): Promise<TaskWithAssignees> {
    const task = await this.getTaskOrThrow(id);
    this.assertIsRootTask(task);
    const creator = await this.getCreatorOrgFields(task.createdById);
    this.cascade.assertHasDirectAuthorityOver(actor, creator);
    if (task.status !== TaskStatus.SOUMISE_VALIDATION) {
      throw new ConflictException('Seule une tâche "Soumise pour validation" peut être rejetée.');
    }

    const updated = await this.prisma.task.update({
      where: { id },
      data: {
        status: TaskStatus.EN_COURS,
        submittedById: null,
        submittedAt: null,
        validationComment: dto.comment,
      },
      select: TASK_SELECT,
    });

    // Commentaire visible sur la tâche — pas seulement un champ caché en
    // base — pour que l'assigné comprenne pourquoi elle repasse en cours.
    await this.prisma.taskComment.create({
      data: { taskId: id, authorId: actor.id, body: `Rejet : ${dto.comment}` },
    });

    await this.logStatusChange(actor, task.status, updated, AuditAction.REJET);

    await this.notifications.notifyMany(
      task.assignees.map((a) => a.userId).filter((id) => id !== actor.id),
      NotificationType.TACHE_REJETEE,
      'Tâche rejetée — à reprendre',
      dto.comment,
      `/tasks/${id}`,
      task.title,
    );

    return updated;
  }

  // --------------------------------------------------------------------
  // Co-responsabilité (RF-TAC-02)
  // --------------------------------------------------------------------

  async addAssignee(actor: AuthenticatedUser, taskId: string, dto: CreateTaskAssigneeDto) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertCanModify(actor, task);

    const candidate = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!candidate) throw new NotFoundException('Utilisateur introuvable');
    // S'assigner soi-même du travail n'est pas une action de validation — jamais
    // bloqué par l'absence d'auto-autorité de CascadeService (voir sa docstring).
    if (candidate.id !== actor.id) {
      this.cascade.assertHasDirectAuthorityOver(actor, candidate);
    }

    const roleOnTask = dto.roleOnTask ?? TaskAssigneeRole.RESPONSABLE;
    const assignee = await this.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId, userId: dto.userId } },
      update: { roleOnTask },
      create: { taskId, userId: dto.userId, roleOnTask },
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Task',
      entityId: taskId,
      metadata: { event: 'assignee_added', userId: dto.userId, roleOnTask },
    });

    if (dto.userId !== actor.id) {
      await this.notifications.notify(
        dto.userId,
        NotificationType.TACHE_ASSIGNEE,
        'Tâche assignée',
        task.title,
        `/tasks/${taskId}`,
        task.title,
      );
    }

    return assignee;
  }

  async removeAssignee(actor: AuthenticatedUser, taskId: string, userId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertCanModify(actor, task);

    await this.prisma.taskAssignee.deleteMany({ where: { taskId, userId } });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.MODIFICATION,
      entityType: 'Task',
      entityId: taskId,
      metadata: { event: 'assignee_removed', userId },
    });
  }

  // --------------------------------------------------------------------
  // Commentaires + mentions (RF-TAC-08)
  // --------------------------------------------------------------------

  async addComment(actor: AuthenticatedUser, taskId: string, dto: CreateCommentDto) {
    const task = await this.findOneVisibleTo(actor, taskId);

    if (dto.mentionedUserIds?.length) {
      const count = await this.prisma.user.count({ where: { id: { in: dto.mentionedUserIds } } });
      if (count !== dto.mentionedUserIds.length) {
        throw new NotFoundException('Un ou plusieurs utilisateurs mentionnés sont introuvables');
      }
    }

    const comment = await this.prisma.taskComment.create({
      data: {
        taskId: task.id,
        authorId: actor.id,
        body: dto.body,
        mentions: dto.mentionedUserIds?.length
          ? { create: dto.mentionedUserIds.map((userId) => ({ mentionedUserId: userId })) }
          : undefined,
      },
      include: { mentions: true },
    });

    if (dto.mentionedUserIds?.length) {
      await this.notifications.notifyMany(
        dto.mentionedUserIds.filter((id) => id !== actor.id),
        NotificationType.MENTION_COMMENTAIRE,
        'Vous avez été mentionné',
        dto.body.length > 200 ? `${dto.body.slice(0, 200)}…` : dto.body,
        `/tasks/${taskId}`,
      );
    }

    return comment;
  }

  async listComments(actor: AuthenticatedUser, taskId: string) {
    await this.findOneVisibleTo(actor, taskId);
    return this.prisma.taskComment.findMany({
      where: { taskId },
      include: { mentions: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  // --------------------------------------------------------------------
  // Pièces jointes (RF-TAC-05) — métadonnées uniquement, cf. dto.
  // --------------------------------------------------------------------

  /** Une ou plusieurs pièces jointes en un seul appel (RF-TAC : documents de
   * référence à la création, pièce jointe avant soumission) — voir StorageService,
   * le même stockage disque que la GED (§7.7, doc du même nom sur la limite
   * du disque éphémère en production). */
  async addAttachments(actor: AuthenticatedUser, taskId: string, files: Express.Multer.File[]) {
    const task = await this.getTaskOrThrow(taskId);
    await this.assertCanAttach(actor, task);
    if (files.length === 0) throw new ConflictException('Aucun fichier reçu.');

    const attachments = [];
    for (const file of files) {
      const { fileKey, sizeBytes } = await this.storage.save(file.buffer, file.originalname);
      const attachment = await this.prisma.taskAttachment.create({
        data: {
          taskId,
          fileName: file.originalname,
          fileKey,
          mimeType: file.mimetype,
          sizeBytes,
          uploadedById: actor.id,
        },
      });
      attachments.push(attachment);

      await this.audit.log({
        actorId: actor.id,
        action: AuditAction.CREATION,
        entityType: 'TaskAttachment',
        entityId: attachment.id,
        metadata: { taskId, fileName: file.originalname },
      });
    }

    return attachments;
  }

  async listAttachments(actor: AuthenticatedUser, taskId: string) {
    await this.findOneVisibleTo(actor, taskId);
    return this.prisma.taskAttachment.findMany({ where: { taskId }, orderBy: { uploadedAt: 'desc' } });
  }

  async downloadAttachment(actor: AuthenticatedUser, taskId: string, attachmentId: string) {
    await this.findOneVisibleTo(actor, taskId);
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.taskId !== taskId) {
      throw new NotFoundException('Pièce jointe introuvable');
    }
    return { attachment, stream: this.storage.createReadStream(attachment.fileKey) };
  }

  async removeAttachment(actor: AuthenticatedUser, taskId: string, attachmentId: string): Promise<void> {
    const task = await this.getTaskOrThrow(taskId);
    const attachment = await this.prisma.taskAttachment.findUnique({ where: { id: attachmentId } });
    if (!attachment || attachment.taskId !== taskId) {
      throw new NotFoundException('Pièce jointe introuvable');
    }

    if (attachment.uploadedById !== actor.id) {
      await this.assertCanModify(actor, task);
    }

    await this.prisma.taskAttachment.delete({ where: { id: attachmentId } });
    await this.storage.delete(attachment.fileKey);

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.SUPPRESSION,
      entityType: 'TaskAttachment',
      entityId: attachmentId,
      metadata: { taskId },
    });
  }

  // --------------------------------------------------------------------
  // Tâches récurrentes (RF-TAC-09) — génération manuelle de la prochaine
  // occurrence. La régénération automatique par planification (cron)
  // suppose @nestjs/schedule ou un déclencheur externe : hors périmètre
  // de cette passe, à ajouter séparément.
  // --------------------------------------------------------------------

  async generateNextOccurrence(actor: AuthenticatedUser, taskId: string): Promise<TaskWithAssignees> {
    const source = await this.getTaskOrThrow(taskId);
    if (actor.id !== source.createdById && actor.role !== SystemRole.ADMIN_SYSTEME) {
      throw new ForbiddenException('Seul le créateur ou un administrateur peut générer une occurrence.');
    }
    if (!source.isRecurring || !source.recurrenceFrequency) {
      throw new ConflictException("Cette tâche n'est pas configurée comme récurrente.");
    }
    if (source.recurrenceEndDate && new Date() > source.recurrenceEndDate) {
      throw new ConflictException('La période de récurrence de cette tâche est terminée.');
    }

    const occurrence = await this.prisma.task.create({
      data: {
        title: source.title,
        description: source.description,
        priority: source.priority,
        confidentiality: source.confidentiality,
        dueDate: this.computeNextDueDate(source.dueDate, source.recurrenceFrequency),
        divisionId: source.divisionId,
        sectionId: source.sectionId,
        celluleId: source.celluleId,
        projectId: source.projectId,
        createdById: source.createdById,
        recurrenceSourceId: source.id,
        assignees: {
          create: source.assignees.map((a) => ({ userId: a.userId, roleOnTask: a.roleOnTask })),
        },
      },
      select: TASK_SELECT,
    });

    await this.audit.log({
      actorId: actor.id,
      action: AuditAction.CREATION,
      entityType: 'Task',
      entityId: occurrence.id,
      metadata: { event: 'recurrence_occurrence', recurrenceSourceId: source.id },
    });

    return occurrence;
  }

  // --------------------------------------------------------------------
  // Recherches favorites (RF-TAC-11) — purement personnelles, pas de cascade.
  // --------------------------------------------------------------------

  createSavedFilter(actor: AuthenticatedUser, dto: CreateSavedFilterDto) {
    return this.prisma.savedFilter.create({
      data: { userId: actor.id, name: dto.name, filterJson: dto.filterJson as Prisma.InputJsonValue },
    });
  }

  listSavedFilters(actor: AuthenticatedUser) {
    return this.prisma.savedFilter.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' } });
  }

  async removeSavedFilter(actor: AuthenticatedUser, id: string): Promise<void> {
    const filter = await this.prisma.savedFilter.findUnique({ where: { id } });
    if (!filter || filter.userId !== actor.id) throw new NotFoundException('Filtre introuvable');
    await this.prisma.savedFilter.delete({ where: { id } });
  }

  // --------------------------------------------------------------------
  // Tableau de bord (RF-TAC-12)
  // --------------------------------------------------------------------

  async dashboard(actor: AuthenticatedUser) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const baseWhere = this.scopedWhere(actor, { parentTaskId: null });

    const [total, enCours, enAttenteValidation, enRetard, termineesCeMois] = await Promise.all([
      this.prisma.task.count({ where: baseWhere }),
      this.prisma.task.count({ where: { ...baseWhere, status: TaskStatus.EN_COURS } }),
      this.prisma.task.count({ where: { ...baseWhere, status: TaskStatus.SOUMISE_VALIDATION } }),
      this.prisma.task.count({
        where: { ...baseWhere, status: { not: TaskStatus.TERMINEE }, dueDate: { lt: now } },
      }),
      this.prisma.task.count({
        where: { ...baseWhere, status: TaskStatus.TERMINEE, completedAt: { gte: startOfMonth } },
      }),
    ]);

    return { total, enCours, enAttenteValidation, enRetard, termineesCeMois };
  }

  // --------------------------------------------------------------------
  // Aides privées
  // --------------------------------------------------------------------

  private async getTaskOrThrow(id: string): Promise<TaskWithAssignees> {
    const task = await this.prisma.task.findUnique({ where: { id }, select: TASK_SELECT });
    if (!task) throw new NotFoundException('Tâche introuvable');
    return task;
  }

  private assertVisible(actor: AuthenticatedUser, task: TaskWithAssignees): void {
    if (task.createdById === actor.id) return;
    if (task.assignees.some((a) => a.userId === actor.id)) return;
    if (this.cascade.canViewTaskByOrgScope(actor, task)) return;
    throw new ForbiddenException('Tâche hors de votre périmètre');
  }

  /** Filtre Prisma combinant visibilité (créateur/assigné/périmètre cascade) et filtres additionnels. */
  private scopedWhere(actor: AuthenticatedUser, extra: Prisma.TaskWhereInput): Prisma.TaskWhereInput {
    const orgScopeWhere = this.cascade.getTaskOrgScopeWhere(actor);
    const visibilityOr: Prisma.TaskWhereInput[] = [
      { createdById: actor.id },
      { assignees: { some: { userId: actor.id } } },
    ];
    if (orgScopeWhere) visibilityOr.push(orgScopeWhere);
    return { OR: visibilityOr, ...extra };
  }

  /** Créateur ou son supérieur hiérarchique direct (§4.1 : modification/suppression/validation). */
  private async assertCanModify(actor: AuthenticatedUser, task: TaskWithAssignees): Promise<void> {
    if (actor.id === task.createdById) return;
    const creator = await this.getCreatorOrgFields(task.createdById);
    this.cascade.assertHasDirectAuthorityOver(actor, creator);
  }

  private async assertCanAttach(actor: AuthenticatedUser, task: TaskWithAssignees): Promise<void> {
    if (task.createdById === actor.id) return;
    if (task.assignees.some((a) => a.userId === actor.id)) return;
    const creator = await this.getCreatorOrgFields(task.createdById);
    if (this.cascade.hasDirectAuthorityOver(actor, creator)) return;
    throw new ForbiddenException(
      'Seuls le créateur, un supérieur hiérarchique, ou une personne assignée peuvent déposer une pièce jointe.',
    );
  }

  private assertIsCreatorOrAnyAssignee(actor: AuthenticatedUser, task: TaskWithAssignees): void {
    if (task.createdById === actor.id) return;
    if (task.assignees.some((a) => a.userId === actor.id)) return;
    throw new ForbiddenException('Seuls le créateur ou une personne assignée peuvent effectuer cette action.');
  }

  private assertIsCreatorOrResponsable(actor: AuthenticatedUser, task: TaskWithAssignees): void {
    if (task.createdById === actor.id) return;
    if (
      task.assignees.some((a) => a.userId === actor.id && a.roleOnTask === TaskAssigneeRole.RESPONSABLE)
    ) {
      return;
    }
    throw new ForbiddenException('Seuls le créateur ou un responsable assigné peuvent effectuer cette action.');
  }

  private assertIsRootTask(task: TaskWithAssignees): void {
    if (task.parentTaskId) {
      throw new ConflictException(
        'Les sous-tâches ne suivent pas le workflow de validation — utilisez POST /tasks/:id/toggle.',
      );
    }
  }

  /** Créateur, n'importe quel assigné, ou leur supérieur hiérarchique direct à l'un ou l'autre. */
  private async assertCanToggleSubtask(actor: AuthenticatedUser, subtask: TaskWithAssignees): Promise<void> {
    if (subtask.createdById === actor.id) return;
    if (subtask.assignees.some((a) => a.userId === actor.id)) return;

    const creator = await this.getCreatorOrgFields(subtask.createdById);
    if (this.cascade.hasDirectAuthorityOver(actor, creator)) return;

    if (subtask.assignees.length > 0) {
      const assigneeUsers = await this.prisma.user.findMany({
        where: { id: { in: subtask.assignees.map((a) => a.userId) } },
        select: { id: true, divisionId: true, sectionId: true, celluleId: true },
      });
      if (assigneeUsers.some((u) => this.cascade.hasDirectAuthorityOver(actor, u))) return;
    }

    throw new ForbiddenException(
      'Seuls le créateur, une personne assignée, ou leur supérieur hiérarchique direct peuvent cocher cette sous-tâche.',
    );
  }

  private async assertCanAssignAll(actor: AuthenticatedUser, userIds: string[]): Promise<void> {
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (users.length !== userIds.length) {
      throw new NotFoundException('Un ou plusieurs utilisateurs assignés sont introuvables');
    }
    for (const user of users) {
      // S'assigner soi-même du travail n'est pas une action de validation — jamais
      // bloqué par l'absence d'auto-autorité de CascadeService (voir sa docstring).
      if (user.id === actor.id) continue;
      this.cascade.assertHasDirectAuthorityOver(actor, user);
    }
  }

  private async getCreatorOrgFields(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, divisionId: true, sectionId: true, celluleId: true },
    });
    if (!user) throw new NotFoundException('Créateur de la tâche introuvable');
    return user;
  }

  private async recomputeParentProgress(parentId: string): Promise<void> {
    const subtasks = await this.prisma.task.findMany({
      where: { parentTaskId: parentId },
      select: { status: true },
    });

    const progressPercent =
      subtasks.length === 0
        ? null
        : Math.round((subtasks.filter((s) => s.status === TaskStatus.TERMINEE).length / subtasks.length) * 100);

    await this.prisma.task.update({ where: { id: parentId }, data: { progressPercent } });
  }

  private async logStatusChange(
    actor: AuthenticatedUser,
    fromStatus: TaskStatus,
    updated: TaskWithAssignees,
    action: AuditAction = AuditAction.MODIFICATION,
  ): Promise<void> {
    await this.audit.log({
      actorId: actor.id,
      action,
      entityType: 'Task',
      entityId: updated.id,
      metadata: { event: 'status_change', from: fromStatus, to: updated.status },
    });
  }

  private computeNextDueDate(previousDueDate: Date | null, frequency: RecurrenceFrequency): Date | undefined {
    const base = previousDueDate ? new Date(previousDueDate) : new Date();
    switch (frequency) {
      case RecurrenceFrequency.QUOTIDIENNE:
        base.setDate(base.getDate() + 1);
        break;
      case RecurrenceFrequency.HEBDOMADAIRE:
        base.setDate(base.getDate() + 7);
        break;
      case RecurrenceFrequency.MENSUELLE:
        base.setMonth(base.getMonth() + 1);
        break;
    }
    return base;
  }

  /** Mêmes invariants que UsersService.assertOrgAttachmentValid, appliqués à Task (divisionId/celluleId mutuellement exclusifs, section ⊂ division). */
  private async assertOrgAttachmentValid(input: OrgAttachmentInput): Promise<void> {
    if (input.divisionId && input.celluleId) {
      throw new ConflictException(
        'Une tâche ne peut pas être rattachée à la fois à une Division et à une Cellule.',
      );
    }
    if (input.sectionId) {
      if (!input.divisionId) {
        throw new ConflictException('Une Section ne peut être renseignée sans Division.');
      }
      const section = await this.prisma.section.findUnique({ where: { id: input.sectionId } });
      if (!section || section.divisionId !== input.divisionId) {
        throw new ConflictException("Cette Section n'appartient pas à la Division indiquée.");
      }
    }
    if (input.divisionId) {
      const division = await this.prisma.division.findUnique({ where: { id: input.divisionId } });
      if (!division) throw new NotFoundException('Division introuvable');
    }
    if (input.celluleId) {
      const cellule = await this.prisma.cellule.findUnique({ where: { id: input.celluleId } });
      if (!cellule) throw new NotFoundException('Cellule introuvable');
    }
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException('Projet introuvable');
  }
}
