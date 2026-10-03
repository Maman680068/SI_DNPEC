import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { NavigationService } from './navigation.service';

/**
 * Compteurs du menu, « À traiter » et menu « Créer » — api/v1/navigation (refonte de l'interface).
 * Ouverte aux stagiaires : le menu leur est affiché (le service ne leur compte que leurs tâches et messages).
 */
@OuvertAuxStagiaires()
@Controller('api/v1/navigation')
export class NavigationController {
  constructor(private readonly navigation: NavigationService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser) {
    return this.navigation.navigation(actor);
  }
}
