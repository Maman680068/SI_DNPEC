import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ComptesSyntheseService } from './comptes-synthese.service';

/** Comptes et habilitations : chiffres, rôles fonctionnels, sécurité, agents sans compte ; rappel et invitation. */
@Controller('api/v1/comptes')
export class ComptesSyntheseController {
  constructor(private readonly comptes: ComptesSyntheseService) {}

  @Get('synthese')
  synthese(@CurrentUser() actor: AuthenticatedUser) {
    return this.comptes.synthese(actor);
  }

  @Post('rappel-double-authentification')
  @HttpCode(200)
  rappel(@CurrentUser() actor: AuthenticatedUser) {
    return this.comptes.rappelDoubleAuthentification(actor);
  }

  @Post(':id/renvoyer-invitation')
  @HttpCode(200)
  renvoyerInvitation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.comptes.renvoyerInvitation(actor, id);
  }
}
