import { IsOptional, IsString, Length } from 'class-validator';

export class DecideLeaveRequestDto {
  @IsOptional()
  @IsString()
  @Length(1, 2000)
  comment?: string;
}
