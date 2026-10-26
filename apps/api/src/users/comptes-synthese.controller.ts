import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ComptesSyntheseService } from './comptes-synthese.service';

/** Comptes et habilitations : rôles fonctionnels, double authentification, agents sans compte. */
@Controller('api/v1/comptes')
export class ComptesSyntheseController {
  constructor(private readonly comptes: ComptesSyntheseService) {}

  @Get('synthese')
  synthese(@CurrentUser() actor: AuthenticatedUser) {
    return this.comptes.synthese(actor);
  }
}
