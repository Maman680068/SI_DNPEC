import { Controller, Get, Param, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { LeaveRequestsService } from './leave-requests.service';
import { SimulationCongeDto } from '../dto/simulation-conge.dto';

/** Refonte de l'interface : contexte de la fenêtre d'avis ou de décision d'un congé (lecture seule). */
@Controller('api/v1/conges')
export class CongesContexteController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  /** Simulation d'une demande de l'acteur (jours décomptés, reprise, solde après) — lecture seule. */
  @Get('simulation')
  simulation(@Query() q: SimulationCongeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.simulation(actor, q.leaveTypeId, q.debut, q.fin);
  }

  @Get(':id/contexte')
  contexte(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.contexte(actor, id);
  }
}
