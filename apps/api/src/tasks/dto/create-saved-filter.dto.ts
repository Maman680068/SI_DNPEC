import { IsObject, IsString, Length } from 'class-validator';

export class CreateSavedFilterDto {
  @IsString()
  @Length(1, 100)
  name!: string;

  @IsObject()
  filterJson!: Record<string, unknown>;
}
