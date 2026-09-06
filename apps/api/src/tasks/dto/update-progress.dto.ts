import { IsInt, Max, Min } from 'class-validator';

/** Voir TasksService.updateProgress — refusé si la tâche a des sous-tâches
 * (progressPercent est alors calculé automatiquement, pas modifiable ici). */
export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progressPercent!: number;
}
