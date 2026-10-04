import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ProfilService } from './profil.service';

/** Page « Mon profil » (refonte, étape 9) : lecture de son propre profil, ouverte à tous les comptes. */
@OuvertAuxStagiaires()
@Controller('api/v1/profil')
export class ProfilController {
  constructor(private readonly profil: ProfilService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser) {
    return this.profil.profil(actor);
  }
}
