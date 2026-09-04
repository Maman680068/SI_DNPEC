import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class CreateLeaveRequestDto {
  @IsString()
  leaveTypeId!: string;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  endDate!: string;

  @IsOptional()
  @IsString()
  @Length(1, 1000)
  reason?: string;
}
