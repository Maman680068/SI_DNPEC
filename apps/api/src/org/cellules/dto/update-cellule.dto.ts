import { PartialType } from '@nestjs/mapped-types';
import { CreateCelluleDto } from './create-cellule.dto';

export class UpdateCelluleDto extends PartialType(CreateCelluleDto) {}
