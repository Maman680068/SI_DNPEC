import { Body, Controller, Get, HttpCode, Param, Post, Put, Query, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ModelesService } from './modeles.service';
import { AffectationsModelisationService } from './affectations.service';
import { AffectationDto, DemandeDerogationDto, DepotPaquetDto, ExecutionDto, MotifDto, ReglagesDto } from './dto/modelisation.dto';
import { TAILLE_MAX_PAQUET } from './paquet';

/** Un octet de plus que la limite : le dépassement est refusé par le contrôle du paquet, en français. */
const paquetOptions = { storage: memoryStorage(), limits: { fileSize: TAILLE_MAX_PAQUET + 1, files: 1 } };

/** Référentiel des modèles (domaine B, lot B1) — routes sous api/v1, fermées aux stagiaires. */
@Controller('api/v1/modeles')
export class ModelesController {
  constructor(private readonly modeles: ModelesService) {}

  @Get()
  liste(@CurrentUser() actor: AuthenticatedUser) {
    return this.modeles.liste(actor);
  }

  /** Dépôt d'un paquet (.zip) : la case de confirmation des données est obligatoire. */
  @Post('versions')
  @UseInterceptors(FileInterceptor('paquet', paquetOptions))
  deposer(@CurrentUser() actor: AuthenticatedUser, @UploadedFile() paquet: Express.Multer.File | undefined, @Body() dto: DepotPaquetDto) {
    return this.modeles.deposer(actor, paquet, dto?.donneesConfirmees);
  }

  @Get('versions/:id')
  version(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.detailVersion(actor, id);
  }

  @Post('versions/:id/verification')
  @HttpCode(200)
  relancer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.relancerVerification(actor, id);
  }

  @Put('versions/:id/reglages')
  regler(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReglagesDto) {
    return this.modeles.regler(actor, id, dto);
  }

  @Post('versions/:id/envoi')
  @HttpCode(200)
  envoyer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.envoyer(actor, id);
  }

  @Post('versions/:id/abandon')
  @HttpCode(200)
  abandonner(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.modeles.abandonner(actor, id, dto.motif);
  }

  @Post('versions/:id/derogations')
  @HttpCode(200)
  demanderDerogation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: DemandeDerogationDto) {
    return this.modeles.demanderDerogation(actor, id, dto.controleId, dto.motif);
  }

  @Post('versions/:id/derogations/:controleId/confirmation')
  @HttpCode(200)
  confirmerDerogation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('controleId') controleId: string) {
    return this.modeles.confirmerDerogation(actor, id, controleId);
  }

  @Post('versions/:id/approbation')
  @HttpCode(200)
  approuver(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.approuver(actor, id);
  }

  @Post('versions/:id/refus')
  @HttpCode(200)
  refuser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.modeles.refuser(actor, id, dto.motif);
  }

  @Get(':id')
  fiche(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.modeles.fiche(actor, id);
  }

  /** Exécution interne (pas encore d'écran) : analystes et responsables, version active ; 202 + suivi du travail. */
  @Post(':id/executer')
  @HttpCode(202)
  executer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ExecutionDto) {
    return this.modeles.executer(actor, id, dto.scenario);
  }
}

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
