import { Type } from 'class-transformer';
import { IsBooleanString, IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
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
}
