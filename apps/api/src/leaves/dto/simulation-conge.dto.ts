import { IsDateString, IsString } from 'class-validator';

/** Paramètres de la simulation d'une demande de congé (lecture seule). */
export class SimulationCongeDto {
  @IsString()
  leaveTypeId!: string;

  @IsDateString()
  debut!: string;

  @IsDateString()
  fin!: string;
}
