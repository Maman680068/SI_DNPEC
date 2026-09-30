import { Type } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsIn, IsOptional, IsString, Length, MaxLength, MinLength, ValidateNested } from 'class-validator';
import { TYPES_OBJET } from '../objets-plateforme.service';

export class LienObjetDto {
  @IsIn(TYPES_OBJET as unknown as string[])
  type!: string;

  @IsString()
  @Length(1, 60)
  id!: string;
}

export class MessageFilDto {
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  corps!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => LienObjetDto)
  lien?: LienObjetDto;
}

export class NouveauFilDto extends MessageFilDto {
  @IsString()
  @Length(2, 200)
  objet!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  destinataires!: string[];
}

export class RechercheDto {
  @IsString()
  @MinLength(3)
  @MaxLength(100)
  q!: string;
}
