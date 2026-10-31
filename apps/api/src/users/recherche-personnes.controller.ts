import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { RecherchePersonnesService } from './recherche-personnes.service';

/** Recherche de personnes de la messagerie (ouverte aux stagiaires, comme la route `users/search`). */
@Controller('api/v1/personnes')
export class RecherchePersonnesController {
  constructor(private readonly recherche: RecherchePersonnesService) {}

  @OuvertAuxStagiaires()
  @Get('recherche')
  rechercher(@CurrentUser() actor: AuthenticatedUser, @Query('q') q?: string) {
    return this.recherche.rechercher(actor, typeof q === 'string' ? q.slice(0, 100) : undefined);
  }
}
