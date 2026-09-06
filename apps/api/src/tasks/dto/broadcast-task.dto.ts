import { IsBoolean, IsDateString, IsEnum, IsOptional, IsString, Length } from 'class-validator';
import { TaskPriority } from '@prisma/client';

export enum BroadcastMode {
  /** Une seule tâche, tous les membres actifs de la division en co-responsables. */
  COLLECTIVE = 'COLLECTIVE',
  /** Une tâche par membre actif de la division, statut indépendant pour chacune. */
  INDIVIDUAL = 'INDIVIDUAL',
}

export class BroadcastTaskDto {
  @IsString()
  divisionId!: string;

  @IsEnum(BroadcastMode)
  mode!: BroadcastMode;

  @IsString()
  @Length(2, 300)
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsBoolean()
  documentRequired?: boolean;
}
