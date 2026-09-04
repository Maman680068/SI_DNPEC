import { IsString, Length } from 'class-validator';

export class RejectTaskDto {
  // Requis : posté comme commentaire visible sur la tâche au moment du
  // rejet, pour que l'assigné comprenne pourquoi elle repasse en cours.
  @IsString()
  @Length(2, 2000)
  comment!: string;
}
