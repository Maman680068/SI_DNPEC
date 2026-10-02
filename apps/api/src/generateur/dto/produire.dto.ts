import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';

export const TYPES_GENERES = ['ATTESTATION_TRAVAIL', 'ORDRE_MISSION', 'RAPPORT_ACTIVITE'] as const;
export type TypeGenere = (typeof TYPES_GENERES)[number];
export const PERIMETRES = ['AGENT', 'SECTION', 'DIVISION', 'CELLULE', 'DIRECTION'] as const;
export type Perimetre = (typeof PERIMETRES)[number];

/** Document à produire : l'objet enregistré (attestation, ordre de mission) ou le périmètre et la
 * période d'un rapport d'activité. Aucune donnée n'est ressaisie (SIG-RF-DOC-01). */
export class ProduireDto {
  @IsIn(TYPES_GENERES)
  type!: TypeGenere;

  @IsOptional()
  @IsString()
  attestationId?: string;

  @IsOptional()
  @IsString()
  ordreMissionId?: string;

  @IsOptional()
  @IsIn(PERIMETRES)
  perimetre?: Perimetre;

  @IsOptional()
  @IsString()
  cibleId?: string;

  @IsOptional()
  @IsDateString()
  debut?: string;

  @IsOptional()
  @IsDateString()
  fin?: string;

  @IsOptional()
  @IsIn(['PDF', 'DOCX'])
  format?: 'PDF' | 'DOCX';
}

export class TransmettreDto extends ProduireDto {
  @IsString()
  destinataireId!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  message?: string;
}
