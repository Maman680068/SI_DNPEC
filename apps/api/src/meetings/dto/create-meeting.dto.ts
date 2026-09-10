import { ArrayUnique, IsArray, IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateMeetingDto {
  @IsString()
  @Length(2, 300)
  title!: string;

  @IsOptional()
  @IsString()
  agenda?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsDateString()
  startAt!: string;

  @IsOptional()
  @IsDateString()
  endAt?: string;

  // L'organisateur est ajouté automatiquement (voir MeetingsService.create) —
  // cette liste ne porte que les autres invités.
  @IsArray()
  @IsString({ each: true })
  @ArrayUnique()
  participantIds!: string[];
}
