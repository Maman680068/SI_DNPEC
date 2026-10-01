import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { AuditAction } from '@prisma/client';

export class ModifierParametreDto {
  @Type(() => Number) @IsInt({ message: 'Valeur entière attendue.' }) valeur!: number;
}

export class TestRestaurationDto {
  @IsDateString() date!: string;
  @IsIn(['REUSSI', 'ECHEC']) resultat!: 'REUSSI' | 'ECHEC';
  @IsOptional() @IsString() @MaxLength(500) commentaire?: string;
}

export class FiltresAuditDto {
  @IsOptional() @IsDateString() du?: string;
  @IsOptional() @IsDateString() au?: string;
  @IsOptional() @IsString() acteurId?: string;
  @IsOptional() @IsString() @MaxLength(100) entityType?: string;
  @IsOptional() @IsEnum(AuditAction) action?: AuditAction;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200) taille?: number;
}
