import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateTaskDto } from './create-task.dto';

// L'assignation initiale et la récurrence ne se modifient pas via ce DTO :
// assignees -> POST/DELETE /tasks/:id/assignees ; récurrence -> figée après
// création pour ne pas complexifier la génération d'occurrences déjà émises.
export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['assignees', 'recurrenceFrequency', 'recurrenceEndDate'] as const),
) {}
