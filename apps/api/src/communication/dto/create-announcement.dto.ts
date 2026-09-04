import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsEnum,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { AnnouncementScope } from '@prisma/client';

export class CreateAnnouncementDto {
  @IsString()
  @Length(2, 200)
  title!: string;

  @IsString()
  @Length(1, 4000)
  body!: string;

  @IsEnum(AnnouncementScope)
  scope!: AnnouncementScope;

  @ValidateIf(
    (o: CreateAnnouncementDto) =>
      o.scope === AnnouncementScope.DIVISION || o.scope === AnnouncementScope.SECTION,
  )
  @IsString()
  divisionId?: string;

  @ValidateIf((o: CreateAnnouncementDto) => o.scope === AnnouncementScope.SECTION)
  @IsString()
  sectionId?: string;

  @ValidateIf((o: CreateAnnouncementDto) => o.scope === AnnouncementScope.CELLULE)
  @IsString()
  celluleId?: string;

  @ValidateIf((o: CreateAnnouncementDto) => o.scope === AnnouncementScope.GROUPE_PERSONNALISE)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  recipientUserIds?: string[];
}
