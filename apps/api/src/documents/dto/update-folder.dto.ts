import { IsOptional, IsString, Length } from 'class-validator';

export class UpdateFolderDto {
  @IsOptional()
  @IsString()
  @Length(1, 200)
  name?: string;

  @IsOptional()
  @IsString()
  parentFolderId?: string;
}
