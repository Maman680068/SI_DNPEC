import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AnnuaireService } from './annuaire.service';

/** Annuaire repensé (S4) — mêmes droits que l'annuaire actuel (tout compte connecté, hors stagiaires). */
@Controller('api/v1/annuaire')
export class AnnuaireController {
  constructor(private readonly annuaire: AnnuaireService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser, @Query('q') q?: string) {
    return this.annuaire.annuaire(actor, typeof q === 'string' ? q.slice(0, 100) : undefined);
  }

  @Get(':id')
  fiche(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.annuaire.fiche(actor, id);
  }
}
