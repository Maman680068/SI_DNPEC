import { IsOptional, IsString, Length } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsString()
  divisionId!: string;

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
