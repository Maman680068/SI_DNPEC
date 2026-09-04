import { IsInt, IsNumber, IsString, Max, Min } from 'class-validator';

/** Provisionnement/ajustement du solde par l'administration (paramétrage RH, pas contenu métier). */
export class SetLeaveBalanceDto {
  @IsString()
  leaveTypeId!: string;

  @IsInt()
  @Min(2000)
  @Max(2100)
  year!: number;

  @IsNumber()
  @Min(0)
  totalDays!: number;
}
