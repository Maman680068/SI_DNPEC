import { Body, Controller, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { VehiculesService } from './vehicules.service';
import { AffecterVehiculeDto, ModifierVehiculeDto, PleinDto, RetourMissionDto, VehiculeDto } from './dto/vehicules.dto';

/** Véhicules de service et carburant (socle N6) — routes sous api/v1/vehicules. */
@Controller('api/v1/vehicules')
export class VehiculesController {
  constructor(private readonly vehicules: VehiculesService) {}

  @Get()
  liste(@CurrentUser() actor: AuthenticatedUser) {
    return this.vehicules.liste(actor);
  }

  @Post()
  creer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: VehiculeDto) {
    return this.vehicules.creer(actor, dto);
  }

  @Get(':id')
  detail(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.vehicules.detail(actor, id);
  }

  @Patch(':id')
  modifier(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierVehiculeDto) {
    return this.vehicules.modifier(actor, id, dto);
  }

  @Post(':id/pleins')
  plein(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: PleinDto) {
    return this.vehicules.ajouterPlein(actor, id, dto);
  }

  @Post('missions/:ordreId/vehicule')
  @HttpCode(200)
  affecter(@CurrentUser() actor: AuthenticatedUser, @Param('ordreId') ordreId: string, @Body() dto: AffecterVehiculeDto) {
    return this.vehicules.affecter(actor, ordreId, dto);
  }

  @Post('missions/:ordreId/retour')
  @HttpCode(200)
  retour(@CurrentUser() actor: AuthenticatedUser, @Param('ordreId') ordreId: string, @Body() dto: RetourMissionDto) {
    return this.vehicules.retour(actor, ordreId, dto);
  }
}
