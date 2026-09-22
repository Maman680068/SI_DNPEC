import { IsString, Length } from 'class-validator';

export class CreatePersonnelDocumentDto {
  @IsString()
  @Length(1, 150)
  label!: string;
}
