import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { StagesService } from './stages.service';
import {
  AccepterPeriodeDto,
  CapaciteDto,
  CreerStageDto,
  EvaluationDto,
  FormatEvaluationDto,
  ModifierPeriodeDto,
  ModifierStageDto,
  MotifDto,
  PeriodeDto,
} from './dto/stage.dto';

/** Le stagiaire accède à son propre stage (le service n'accorde rien d'autre). */
@OuvertAuxStagiaires()
@Controller('stages')
export class StagesController {
  constructor(private readonly stages: StagesService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.stages.list(actor);
  }

  @Get('planning')
  planning(@CurrentUser() actor: AuthenticatedUser, @Query('debut') debut?: string, @Query('fin') fin?: string) {
    return this.stages.planning(actor, debut, fin);
  }

  @Put('capacites')
  fixerCapacite(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CapaciteDto) {
    return this.stages.fixerCapacite(actor, dto);
  }

  @Post()
  creer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreerStageDto) {
    return this.stages.creer(actor, dto);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.findOne(actor, id);
  }

  @Patch(':id')
  modifier(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierStageDto) {
    return this.stages.modifier(actor, id, dto);
  }

  @Post(':id/cloturer')
  cloturer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.cloturer(actor, id);
  }

  @Post(':id/interrompre')
  interrompre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.stages.interrompre(actor, id, dto.motif);
  }

  @Post(':id/periodes')
  ajouterPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: PeriodeDto) {
    return this.stages.ajouterPeriode(actor, id, dto);
  }

  @Patch(':id/periodes/:periodeId')
  modifierPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: ModifierPeriodeDto) {
    return this.stages.modifierPeriode(actor, id, periodeId, dto);
  }

  @Delete(':id/periodes/:periodeId')
  annulerPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.annulerPeriode(actor, id, periodeId);
  }

  @Get(':id/periodes/:periodeId/tuteurs-possibles')
  tuteursPossibles(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.tuteursPossibles(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/accepter')
  accepter(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: AccepterPeriodeDto) {
    return this.stages.accepter(actor, id, periodeId, dto.tuteurId);
  }

  @Post(':id/periodes/:periodeId/refuser')
  refuser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: MotifDto) {
    return this.stages.refuser(actor, id, periodeId, dto.motif);
  }

  @Post(':id/periodes/:periodeId/tuteur')
  changerTuteur(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: AccepterPeriodeDto) {
    return this.stages.changerTuteur(actor, id, periodeId, dto.tuteurId);
  }

  @Post(':id/periodes/:periodeId/format')
  changerFormat(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: FormatEvaluationDto) {
    return this.stages.changerFormat(actor, id, periodeId, dto.formatEvaluation);
  }

  @Put(':id/periodes/:periodeId/evaluation')
  enregistrerEvaluation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: EvaluationDto) {
    return this.stages.enregistrerEvaluation(actor, id, periodeId, dto);
  }

  @Post(':id/periodes/:periodeId/evaluation/soumettre')
  soumettre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.soumettreEvaluation(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/evaluation/viser')
  viser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.viserEvaluation(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/evaluation/renvoyer')
  renvoyer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: MotifDto) {
    return this.stages.renvoyerEvaluation(actor, id, periodeId, dto.motif);
  }
}
