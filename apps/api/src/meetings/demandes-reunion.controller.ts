import { Body, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { DemandesReunionService } from './demandes-reunion.service';
import { AccepterDemandeDto, DemandeReunionDto, RefuserDemandeDto } from './dto/demande-reunion.dto';

/** Demandes de réunion (S1) — fermées aux stagiaires (aucun accès aux réunions). */
@Controller('api/v1/demandes-reunion')
export class DemandesReunionController {
  constructor(private readonly demandes: DemandesReunionService) {}

  @Get()
  liste(@CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.liste(actor);
  }

  @Get(':id')
  lire(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.demandes.lire(actor, id);
  }

  @Post()
  demander(@CurrentUser() actor: AuthenticatedUser, @Body() dto: DemandeReunionDto) {
    return this.demandes.demander(actor, dto);
  }

  @Post(':id/accepter')
  @HttpCode(200)
  accepter(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: AccepterDemandeDto) {
    return this.demandes.accepter(actor, id, dto);
  }

  @Post(':id/refuser')
  @HttpCode(200)
  refuser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: RefuserDemandeDto) {
    return this.demandes.refuser(actor, id, dto.motif);
  }

  @Post(':id/transmettre')
  @HttpCode(200)
  transmettre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.demandes.transmettre(actor, id);
  }
}
