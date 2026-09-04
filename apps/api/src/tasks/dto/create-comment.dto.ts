import { ArrayUnique, IsArray, IsOptional, IsString, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @Length(1, 4000)
  body!: string;

  // Résolution @nom -> id faite côté frontend (autocomplete) plutôt que
  // parsée depuis le texte côté serveur — plus robuste.
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  mentionedUserIds?: string[];
}
