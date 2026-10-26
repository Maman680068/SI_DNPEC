import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { FormationsService } from './formations.service';

/** « Mon profil » : les sessions de formation de la personne connectée (aucune pour un stagiaire). */
@Controller('api/v1/profil')
export class FormationsProfilController {
  constructor(private readonly formations: FormationsService) {}

  @OuvertAuxStagiaires()
  @Get('formations')
  miennes(@CurrentUser() actor: AuthenticatedUser) {
    return this.formations.miennes(actor);
  }
}
