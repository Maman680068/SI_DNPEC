import { IsBoolean, IsOptional, IsString } from 'class-validator';

/** Champs mutables après création (D2) — le reste (titre, date, participants...)
 * n'a pas de parcours de modification à ce jour, hors périmètre de cette passe. */
export class UpdateMeetingDto {
  @IsOptional()
  @IsString()
  minutesText?: string;

  // "Réunion déclarée ouverte" (§4.6, exception D2) : visible à tout
  // utilisateur authentifié, ainsi que son relevé de décisions — voir
  // schema.prisma, Meeting.isOpen.
  @IsOptional()
  @IsBoolean()
  isOpen?: boolean;
}
