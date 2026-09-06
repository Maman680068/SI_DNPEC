// Miroir des enums Prisma exposés par l'API (apps/api/prisma/schema.prisma).
export type TaskStatus = 'A_FAIRE' | 'EN_COURS' | 'SOUMISE_VALIDATION' | 'TERMINEE';
export type TaskPriority = 'URGENT' | 'NORMAL' | 'FAIBLE';
export type TaskConfidentiality =
  | 'PUBLIC_INTERNE'
  | 'CONFIDENTIEL_DIVISION'
  | 'TRES_CONFIDENTIEL_DIRIGEANTS';
export type TaskAssigneeRole = 'RESPONSABLE' | 'COLLABORATEUR';

export interface TaskAssignee {
  id: string;
  userId: string;
  roleOnTask: TaskAssigneeRole;
  assignedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  confidentiality: TaskConfidentiality;
  dueDate: string | null;
  documentRequired: boolean;
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  progressPercent: number | null;
  isRecurring: boolean;
  createdById: string;
  submittedById: string | null;
  submittedAt: string | null;
  validatedById: string | null;
  validatedAt: string | null;
  validationComment: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignees: TaskAssignee[];
}

export interface TaskDashboard {
  total: number;
  enCours: number;
  enAttenteValidation: number;
  enRetard: number;
  termineesCeMois: number;
}

export const KANBAN_COLUMNS: { status: TaskStatus; label: string }[] = [
  { status: 'A_FAIRE', label: 'À faire' },
  { status: 'EN_COURS', label: 'En cours' },
  { status: 'SOUMISE_VALIDATION', label: 'Soumises' },
  { status: 'TERMINEE', label: 'Terminées' },
];

export const STATUS_STEPS: { status: TaskStatus; label: string }[] = [
  { status: 'A_FAIRE', label: 'À faire' },
  { status: 'EN_COURS', label: 'En cours' },
  { status: 'SOUMISE_VALIDATION', label: 'Validation' },
  { status: 'TERMINEE', label: 'Terminée' },
];

export interface TaskCommentMention {
  id: string;
  commentId: string;
  mentionedUserId: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  mentions: TaskCommentMention[];
}

export interface TaskAttachment {
  id: string;
  taskId: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  uploadedAt: string;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: TaskPriority;
  confidentiality?: TaskConfidentiality;
  dueDate?: string;
  documentRequired?: boolean;
  divisionId?: string;
  sectionId?: string;
  celluleId?: string;
  assignees?: { userId: string; roleOnTask?: TaskAssigneeRole }[];
}

/** Voir TasksService.broadcastToDivision : COLLECTIVE = une tâche, tous les
 * membres actifs en co-responsables ; INDIVIDUAL = une tâche par membre,
 * statut indépendant pour chacune. */
export type BroadcastMode = 'COLLECTIVE' | 'INDIVIDUAL';

export interface BroadcastTaskInput {
  divisionId: string;
  mode: BroadcastMode;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string;
  documentRequired?: boolean;
}
