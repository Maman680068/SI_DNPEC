import { IsString, Length } from 'class-validator';

export class RejectLeaveRequestDto {
  // Requis (contrairement à l'approbation) : la personne doit comprendre pourquoi.
  @IsString()
  @Length(2, 2000)
  comment!: string;
}
