import { IsString } from 'class-validator';

export class AssignChefDto {
  @IsString()
  userId!: string;
}
