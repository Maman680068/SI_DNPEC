import { IsDateString, IsOptional, IsString, Length } from 'class-validator';

export class InstructionDto {
  @IsString()
  @Length(3, 300)
  objet!: string;

  @IsString()
  @Length(3, 5000)
  texte!: string;

  @IsString()
  destinataireId!: string;

  @IsOptional()
  @IsString()
  agentConcerneId?: string;

  @IsOptional()
  @IsDateString()
  echeance?: string;
}

export class ExecutionDto {
  @IsString()
  @Length(3, 3000)
  compteRendu!: string;

  @IsOptional()
  @IsString()
  acteId?: string;
}

export class RejetDto {
  @IsString()
  @Length(5, 2000)
  motif!: string;
}
