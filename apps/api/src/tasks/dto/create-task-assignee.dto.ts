import { IsEnum, IsOptional, IsString } from 'class-validator';
import { TaskAssigneeRole } from '@prisma/client';

export class CreateTaskAssigneeDto {
  @IsString()
  userId!: string;

  @IsOptional()
  @IsEnum(TaskAssigneeRole)
  roleOnTask?: TaskAssigneeRole;
}
