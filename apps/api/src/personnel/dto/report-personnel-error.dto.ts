import { IsString, Length } from 'class-validator';

export class ReportPersonnelErrorDto {
  /** Libre (ex. "grade", "adresse personnelle") — affiché tel quel au DRH, pas
   * couplé aux clés internes de verifiedFields pour rester lisible sans traduction. */
  @IsString()
  @Length(1, 100)
  fieldLabel!: string;

  @IsString()
  @Length(1, 2000)
  comment!: string;
}
