import { Controller, Get } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ParametrageCourrierService } from './parametrage-courrier.service';

/** Paramétrage du courrier en une lecture (S9c) : alertes, registres par nature, habilitations par registre. */
@Controller('courrier/parametrage')
export class ParametrageCourrierController {
  constructor(private readonly parametrage: ParametrageCourrierService) {}

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get()
  vue(@CurrentUser() actor: AuthenticatedUser) {
    return this.parametrage.vue(actor);
  }
}
