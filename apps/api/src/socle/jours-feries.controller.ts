import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { JoursFeriesService } from './jours-feries.service';
import { AnneeDto, JourFerieDto, LotJoursFeriesDto, ModifierJourFerieDto } from './dto/jours-feries.dto';

/** Calendrier des jours fériés (socle N3) : lu par tous, tenu par l'administrateur et le DRH. */
@Controller('api/v1/jours-feries')
export class JoursFeriesController {
  constructor(private readonly jours: JoursFeriesService) {}

  @Get()
  lister(@CurrentUser() actor: AuthenticatedUser, @Query() q: AnneeDto) {
    return this.jours.lister(actor, q.annee);
  }

  @Post()
  creer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: JourFerieDto) {
    return this.jours.creer(actor, dto);
  }

  @Post('fetes-fixes')
  reprendre(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AnneeDto) {
    return this.jours.reprendreFixes(actor, dto.annee);
  }

  @Post('lot')
  ajouterLot(@CurrentUser() actor: AuthenticatedUser, @Body() dto: LotJoursFeriesDto) {
    return this.jours.ajouterLot(actor, dto);
  }

  /** Recalcul d'un congé approuvé selon le calendrier actuel (DRH). */
  @Post('conges/:id/recalculer')
  recalculer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.jours.recalculerConge(actor, id);
  }

  @Patch(':id')
  modifier(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierJourFerieDto) {
    return this.jours.modifier(actor, id, dto);
  }

  @Delete(':id')
  supprimer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.jours.supprimer(actor, id);
  }
}
