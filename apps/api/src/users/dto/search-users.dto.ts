import { IsString, Length, MaxLength } from 'class-validator';

/** Voir UsersController.search. */
export class SearchUsersDto {
  @IsString()
  @Length(1, 200)
  @MaxLength(100)
  q!: string;
}
