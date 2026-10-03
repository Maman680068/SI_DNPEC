import { Type } from 'class-transformer';
import { IsBooleanString, IsDateString, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { TaskPriority, TaskStatus } from '@prisma/client';

/** Filtres de GET /tasks (RF-TAC-11). Combinés en ET avec le périmètre de visibilité de l'acteur. */
export class TaskFiltersDto {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  divisionId?: string;

  @IsOptional()
  @IsString()
  sectionId?: string;

  @IsOptional()
  @IsString()
  celluleId?: string;

  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsDateString()
  dueBefore?: string;

  @IsOptional()
  @IsDateString()
  dueAfter?: string;

  // Par défaut, GET /tasks ne renvoie que les tâches de premier niveau
  // (parentTaskId = null) ; passer "true" pour inclure aussi les sous-tâches.
  @IsOptional()
  @Type(() => String)
  @IsBooleanString()
  includeSubtasks?: string;

  // Socle N5 — tâches d'une activité du plan de travail.
  @IsOptional()
  @IsString()
  activiteId?: string;

  // Performance (2026-10) — tâches créées par une personne (« Mes tâches », onglet « Créées par moi »).
  @IsOptional()
  @IsString()
  createdById?: string;

  // Performance (2026-10) — vue de suivi (tableau de bord) : tâches non closes, et tâches closes
  // (Terminée, Validée) depuis moins de 30 jours ; les plus anciennes se retrouvent par les filtres.
  @IsOptional()
  @Type(() => String)
  @IsBooleanString()
  suivi?: string;

  // Performance (2026-10) — nombre maximal de tâches renvoyées (échéances les plus proches d'abord).
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2000)
  limite?: number;

  // Refonte de l'interface — tâches soumises que l'acteur peut valider ou rejeter (onglet « À valider »).
  @IsOptional()
  @Type(() => String)
  @IsBooleanString()
  aValider?: string;
}
