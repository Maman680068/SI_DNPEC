import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { TableauDeBordService } from './tableau-de-bord.service';

/** Tableau de bord par rôle (socle N6) — api/v1/tableau-de-bord. */
@Controller('api/v1/tableau-de-bord')
export class TableauDeBordController {
  constructor(private readonly tableau: TableauDeBordService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser) {
    return this.tableau.tableau(actor);
  }
}
