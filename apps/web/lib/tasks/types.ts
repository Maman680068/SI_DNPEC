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
  divisionId: string | null;
  sectionId: string | null;
  celluleId: string | null;
  projectId: string | null;
  parentTaskId: string | null;
  progressPercent: number;
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
