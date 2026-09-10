import {
  ArrayMinSize,
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  ValidateIf,
} from 'class-validator';
import { AnnouncementScope } from '@prisma/client';

/** Ciblage rigoureusement identique à CreateAnnouncementDto — même enum, mêmes
 * champs conditionnels par scope (voir PollsService.resolveAudienceAndAuthorize). */
export class CreatePollDto {
  @IsString()
  @Length(2, 300)
  question!: string;

  @IsArray()
  @ArrayMinSize(2, { message: 'Un sondage nécessite au moins deux options.' })
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 200, { each: true })
  options!: string[];

  @IsOptional()
  @IsBoolean()
  allowMultiple?: boolean;

  @IsOptional()
  @IsDateString()
  closesAt?: string;

  @IsEnum(AnnouncementScope)
  scope!: AnnouncementScope;

  @ValidateIf((o: CreatePollDto) => o.scope === AnnouncementScope.DIVISION || o.scope === AnnouncementScope.SECTION)
  @IsString()
  divisionId?: string;

  @ValidateIf((o: CreatePollDto) => o.scope === AnnouncementScope.SECTION)
  @IsString()
  sectionId?: string;

  @ValidateIf((o: CreatePollDto) => o.scope === AnnouncementScope.CELLULE)
  @IsString()
  celluleId?: string;

  @ValidateIf((o: CreatePollDto) => o.scope === AnnouncementScope.GROUPE_PERSONNALISE)
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  recipientUserIds?: string[];
}
