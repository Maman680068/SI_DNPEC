import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TableauDeBordService } from './tableau-de-bord.service';
import { ChiffresTableauService } from './chiffres.service';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';

/** Tableau de bord par rôle (socle N6) — api/v1/tableau-de-bord. */
@Controller('api/v1/tableau-de-bord')
export class TableauDeBordController {
  constructor(
    private readonly tableau: TableauDeBordService,
    private readonly chiffresTableau: ChiffresTableauService,
  ) {}

  /** Bande des quatre chiffres selon le profil ; ouverte au stagiaire (ses propres tâches et congés seulement). */
  @OuvertAuxStagiaires()
  @Get('chiffres')
  chiffres(@CurrentUser() actor: AuthenticatedUser) {
    return this.chiffresTableau.chiffres(actor);
  }

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser) {
    return this.tableau.tableau(actor);
  }
}
