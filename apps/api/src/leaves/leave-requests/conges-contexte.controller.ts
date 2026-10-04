import { Controller, Get, Param } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { LeaveRequestsService } from './leave-requests.service';

/** Refonte de l'interface : contexte de la fenêtre d'avis ou de décision d'un congé (lecture seule). */
@Controller('api/v1/conges')
export class CongesContexteController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Get(':id/contexte')
  contexte(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.contexte(actor, id);
  }
}
