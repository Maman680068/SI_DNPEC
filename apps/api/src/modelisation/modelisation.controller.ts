import { Body, Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ModelesService } from './modeles.service';
import { AffectationsModelisationService } from './affectations.service';
import { AffectationDto, MotifDto } from './dto/modelisation.dto';

/** Travaux de calcul et rôles de modélisation (domaine B, lot B1) — routes sous api/v1, fermées aux stagiaires. */
@Controller('api/v1/modelisation')
export class ModelisationController {
  constructor(
    private readonly modeles: ModelesService,
    private readonly affectations: AffectationsModelisationService,
  ) {}

  @Get('travaux/:id')
  travail(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.travail(actor, id);
  }

  @Get('affectations')
  affectationsDe(@CurrentUser() actor: AuthenticatedUser, @Query('userId') userId: string) {
    return this.affectations.pourPersonne(actor, userId ?? '');
  }

  @Post('affectations')
  attribuer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AffectationDto) {
    return this.affectations.attribuer(actor, dto);
  }

  @Post('affectations/:id/fin')
  @HttpCode(200)
  clore(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.affectations.clore(actor, id, dto.motif);
  }

  /** Personnes désignables comme responsable ou suppléant (administrateur, DN, DNA). */
  @Get('personnes')
  personnes(@CurrentUser() actor: AuthenticatedUser) {
    return this.affectations.designables(actor);
  }
}
