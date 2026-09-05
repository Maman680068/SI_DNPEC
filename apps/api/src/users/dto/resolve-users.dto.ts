import { IsString, Length } from 'class-validator';

/** Liste d'ids séparés par des virgules — voir UsersController.resolve. */
export class ResolveUsersDto {
  @IsString()
  @Length(1, 4000)
  ids!: string;
}
