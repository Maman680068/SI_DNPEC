import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ParticipantsReunionService } from './participants-reunion.service';
import { DemandesReunionService } from './demandes-reunion.service';

/** Sélecteur de participants et droits de l'écran des réunions (S1). */
@Controller('api/v1/reunions')
export class ParticipantsReunionController {
  constructor(
    private readonly participants: ParticipantsReunionService,
    private readonly demandes: DemandesReunionService,
  ) {}

  @Get('participants-possibles')
  possibles(@CurrentUser() actor: AuthenticatedUser) {
    return this.participants.possibles(actor);
  }

  /** Créer directement, ou demander à son chef. */
  @Get('droits')
  droits(@CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.droits(actor);
  }
}
