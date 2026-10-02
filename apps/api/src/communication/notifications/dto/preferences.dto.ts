import { IsBoolean, IsInt, IsOptional, Max, Min } from 'class-validator';

export class PreferencesNotificationDto {
  @IsOptional()
  @IsBoolean()
  resumeQuotidien?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  heureResume?: number;
}
