import { Body, Controller, Get, Param, Patch, Post, Query, Res, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ArriveesService } from './arrivees.service';
import { ImputationsService } from './imputations.service';
import { AccesDeleguesService } from './acces-delegues.service';
import { CourrierExportService } from './courrier-export.service';
import { MAX_FICHIERS, OPTIONS_FICHIERS, envoyerExcel, envoyerFichier } from './fichiers';
import {
  ArriveeFiltresDto,
  CompleterPliDto,
  ConvertirImputationDto,
  CreateArriveeDto,
  ImputerDto,
  MotifDto,
  OuvrirAccesDto,
  RequalifierPliDto,
  TraiterImputationDto,
  UpdateArriveeDto,
} from './dto/arrivee.dto';

@Controller('courrier')
export class ArriveesController {
  constructor(
    private readonly arrivees: ArriveesService,
    private readonly imputations: ImputationsService,
    private readonly delegues: AccesDeleguesService,
    private readonly exports: CourrierExportService,
  ) {}

  @Post('arrivees')
  @UseInterceptors(FilesInterceptor('files', MAX_FICHIERS, OPTIONS_FICHIERS))
  enregistrer(@Body() dto: CreateArriveeDto, @UploadedFiles() files: Express.Multer.File[] = [], @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.enregistrer(actor, dto, files ?? []);
  }

  @Get('arrivees')
  lister(@Query() filtres: ArriveeFiltresDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.lister(actor, filtres);
  }

  @Get('arrivees/export.xlsx')
  async exporter(@Query() filtres: ArriveeFiltresDto, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return envoyerExcel(res, await this.exports.arriveesExcel(actor, filtres), 'courrier_arrivee');
  }

  @Get('arrivees/:id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.findOne(actor, id);
  }

  @Patch('arrivees/:id')
  corriger(@Param('id') id: string, @Body() dto: UpdateArriveeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.corriger(actor, id, dto);
  }

  @Post('arrivees/:id/annuler')
  annuler(@Param('id') id: string, @Body() dto: MotifDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.annuler(actor, id, dto);
  }

  @Post('arrivees/:id/classer')
  classer(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.classer(actor, id);
  }

  @Post('arrivees/:id/completer')
  completer(@Param('id') id: string, @Body() dto: CompleterPliDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.completer(actor, id, dto);
  }

  @Post('arrivees/:id/requalifier')
  requalifier(@Param('id') id: string, @Body() dto: RequalifierPliDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.requalifier(actor, id, dto);
  }

  @Post('arrivees/:id/pieces')
  @UseInterceptors(FilesInterceptor('files', MAX_FICHIERS, OPTIONS_FICHIERS))
  ajouterPieces(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[] = [], @CurrentUser() actor: AuthenticatedUser) {
    return this.arrivees.ajouterPieces(actor, id, files ?? []);
  }

  @Get('arrivees/:id/pieces/:pieceId/download')
  async telecharger(
    @Param('id') id: string,
    @Param('pieceId') pieceId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return envoyerFichier(res, await this.arrivees.telechargerPiece(actor, id, pieceId));
  }

  @Post('arrivees/:id/imputations')
  imputer(@Param('id') id: string, @Body() dto: ImputerDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.imputations.imputer(actor, id, dto);
  }

  @Post('imputations/:id/sous-imputations')
  sousImputer(@Param('id') id: string, @Body() dto: ImputerDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.imputations.sousImputer(actor, id, dto);
  }

  @Post('imputations/:id/traiter')
  traiter(@Param('id') id: string, @Body() dto: TraiterImputationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.imputations.traiter(actor, id, dto);
  }

  @Post('imputations/:id/convertir-en-tache')
  convertir(@Param('id') id: string, @Body() dto: ConvertirImputationDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.imputations.convertirEnTache(actor, id, dto);
  }

  /** Personnes que le serveur accepterait comme imputé (imputation ou sous-imputation). */
  @Get('imputables')
  imputables(
    @Query('arriveeId') arriveeId: string | undefined,
    @Query('imputationId') imputationId: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.imputations.imputables(actor, { arriveeId, imputationId });
  }

  /** Personnes à qui l'acteur pourrait ouvrir l'accès à un courrier confidentiel. */
  @Get('delegataires-possibles')
  delegatairesPossibles(
    @Query('arriveeId') arriveeId: string | undefined,
    @Query('acteId') acteId: string | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.delegues.delegatairesPossibles(actor, { arriveeId, acteId });
  }

  @Get('arrivees/:id/acces-delegues')
  listerAcces(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegues.lister(actor, { arriveeId: id });
  }

  @Post('arrivees/:id/acces-delegues')
  ouvrirAcces(@Param('id') id: string, @Body() dto: OuvrirAccesDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegues.ouvrir(actor, { arriveeId: id }, dto.beneficiaireId);
  }

  @Post('acces-delegues/:id/revoquer')
  revoquerAcces(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegues.revoquer(actor, id);
  }
}
