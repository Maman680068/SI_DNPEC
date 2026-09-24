import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { RegistresService } from './registres.service';
import { CourrierTableauDeBordService } from './tableau-de-bord.service';
import { CreateHabilitationDto, CreateRegistreDto, InitialiserCompteurDto, UpdateRegistreDto } from './dto/registre.dto';

/** Paramétrage du courrier (lecture : tout utilisateur — configuration, aucun
 * contenu ; écriture : administrateur système) et tableau de bord personnel. */
@Controller('courrier')
export class RegistresController {
  constructor(
    private readonly registres: RegistresService,
    private readonly tableauDeBord: CourrierTableauDeBordService,
  ) {}

  @Get('tableau-de-bord')
  tableau(@CurrentUser() actor: AuthenticatedUser) {
    return this.tableauDeBord.pour(actor);
  }

  @Get('registres')
  findAll() {
    return this.registres.findAll();
  }

  @Get('unites')
  unites() {
    return this.registres.unites();
  }

  @Get('habilitations/miennes')
  mesHabilitations(@CurrentUser() actor: AuthenticatedUser) {
    return this.registres.findMesHabilitations(actor);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('registres')
  create(@Body() dto: CreateRegistreDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.registres.create(actor, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch('registres/:id')
  update(@Param('id') id: string, @Body() dto: UpdateRegistreDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.registres.update(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get('registres/:id/compteurs')
  compteurs(@Param('id') id: string) {
    return this.registres.compteurs(id);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('registres/:id/compteurs/initialiser')
  initialiser(@Param('id') id: string, @Body() dto: InitialiserCompteurDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.registres.initialiserCompteur(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get('habilitations')
  habilitations() {
    return this.registres.findHabilitations();
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('habilitations')
  createHabilitation(@Body() dto: CreateHabilitationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.registres.createHabilitation(actor, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('habilitations/:id/revoquer')
  revoquerHabilitation(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.registres.revoquerHabilitation(actor, id);
  }
}
