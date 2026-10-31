import { Controller, Get } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AdministrationLogistiqueService } from './administration-logistique.service';

/** Administration de la logistique en une lecture (S9d) : gestionnaires, circuit, catégories et contenu. */
@Controller('logistique/administration')
export class AdministrationLogistiqueController {
  constructor(private readonly administration: AdministrationLogistiqueService) {}

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get()
  vue(@CurrentUser() actor: AuthenticatedUser) {
    return this.administration.vue(actor);
  }
}
