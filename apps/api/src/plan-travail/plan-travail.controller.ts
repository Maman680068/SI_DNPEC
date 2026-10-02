import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PlanTravailService } from './plan-travail.service';
import { ActiviteDto, ModifierActiviteDto, ModifierObjectifDto, ObjectifDto, PlanFiltresDto } from './dto/plan-travail.dto';

/** Plan de travail (socle N5) — routes sous api/v1. */
@Controller('api/v1/plan-travail')
export class PlanTravailController {
  constructor(private readonly plan: PlanTravailService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser, @Query() f: PlanFiltresDto) {
    return this.plan.plan(actor, f);
  }

  @Get('activites-disponibles')
  disponibles(@CurrentUser() actor: AuthenticatedUser) {
    return this.plan.activitesDisponibles(actor);
  }

  @Get('unites/:uniteId/responsables-possibles')
  responsables(@CurrentUser() actor: AuthenticatedUser, @Param('uniteId') uniteId: string) {
    return this.plan.responsablesPossibles(actor, uniteId);
  }

  @Post('objectifs')
  creerObjectif(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ObjectifDto) {
    return this.plan.creerObjectif(actor, dto);
  }

  @Patch('objectifs/:id')
  modifierObjectif(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierObjectifDto) {
    return this.plan.modifierObjectif(actor, id, dto);
  }

  @Delete('objectifs/:id')
  supprimerObjectif(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.plan.supprimerObjectif(actor, id);
  }

  @Post('objectifs/:id/activites')
  creerActivite(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ActiviteDto) {
    return this.plan.creerActivite(actor, id, dto);
  }

  @Get('activites/:id')
  activite(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.plan.activite(actor, id);
  }

  @Patch('activites/:id')
  modifierActivite(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierActiviteDto) {
    return this.plan.modifierActivite(actor, id, dto);
  }

  @Delete('activites/:id')
  supprimerActivite(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.plan.supprimerActivite(actor, id);
  }
}
