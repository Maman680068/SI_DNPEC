import { IsString, Length } from 'class-validator';

/** Voir UsersController.search. */
export class SearchUsersDto {
  @IsString()
  @Length(1, 200)
  q!: string;
}
