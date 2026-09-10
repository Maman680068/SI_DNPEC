import { ArrayMinSize, ArrayUnique, IsArray, IsString } from 'class-validator';

/** Toujours un tableau, même à choix unique (un seul élément) — évite deux formes
 * de payload différentes selon Poll.allowMultiple. PollsService rejette un tableau
 * de plus d'un élément si le sondage n'autorise pas le choix multiple. */
export class VotePollDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique()
  @IsString({ each: true })
  optionIds!: string[];
}
