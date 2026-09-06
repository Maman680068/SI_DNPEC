import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateNested,
} from 'class-validator';
import { RecurrenceFrequency, TaskConfidentiality, TaskPriority } from '@prisma/client';
import { CreateTaskAssigneeDto } from './create-task-assignee.dto';

export class CreateTaskDto {
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
  @IsEnum(TaskConfidentiality)
  confidentiality?: TaskConfidentiality;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

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

  // Bloque le passage à SOUMISE_VALIDATION tant qu'aucune pièce jointe n'est
  // présente (voir TasksService.submit). Sans effet sur une sous-tâche — voir
  // le commentaire de Task.documentRequired dans schema.prisma.
  @IsOptional()
  @IsBoolean()
  documentRequired?: boolean;

  // Assignation initiale (RF-TAC-02) — optionnelle, l'assignation peut aussi
  // se faire ensuite via POST /tasks/:id/assignees.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTaskAssigneeDto)
  @ArrayUnique((a: CreateTaskAssigneeDto) => a.userId)
  assignees?: CreateTaskAssigneeDto[];

  // Récurrence (RF-TAC-09)
  @IsOptional()
  @IsEnum(RecurrenceFrequency)
  recurrenceFrequency?: RecurrenceFrequency;

  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string;
}
