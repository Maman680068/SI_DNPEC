import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query, Res, UploadedFile, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { ActesService } from './actes.service';
import { AccesDeleguesService } from './acces-delegues.service';
import { CourrierExportService } from './courrier-export.service';
import { MAX_FICHIERS, OPTIONS_FICHIERS, envoyerExcel, envoyerFichier } from './fichiers';
import { ActeFiltresDto, CreateActeDto, ExpedierDto, UpdateActeDto, ViserDto } from './dto/acte.dto';
import { MotifDto, OuvrirAccesDto } from './dto/arrivee.dto';

@Controller('courrier/actes')
export class ActesController {
  constructor(
    private readonly actes: ActesService,
    private readonly delegues: AccesDeleguesService,
    private readonly exports: CourrierExportService,
  ) {}

  @Post()
  creer(@Body() dto: CreateActeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.creer(actor, dto);
  }

  @Get()
  lister(@Query() filtres: ActeFiltresDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.lister(actor, filtres);
  }

  @Get('export.xlsx')
  async exporter(@Query() filtres: ActeFiltresDto, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return envoyerExcel(res, await this.exports.actesExcel(actor, filtres), 'departs_actes');
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.findOne(actor, id);
  }

  @Patch(':id')
  modifier(@Param('id') id: string, @Body() dto: UpdateActeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.modifier(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  supprimer(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.supprimer(actor, id);
  }

  @Post(':id/soumettre')
  soumettre(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.soumettre(actor, id);
  }

  @Post(':id/viser')
  viser(@Param('id') id: string, @Body() dto: ViserDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.viser(actor, id, dto);
  }

  @Post(':id/renvoyer')
  renvoyer(@Param('id') id: string, @Body() dto: MotifDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.renvoyer(actor, id, dto);
  }

  @Post(':id/signer')
  @UseInterceptors(FileInterceptor('file', OPTIONS_FICHIERS))
  signer(@Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.signer(actor, id, file);
  }

  @Post(':id/expedier')
  expedier(@Param('id') id: string, @Body() dto: ExpedierDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.expedier(actor, id, dto);
  }

  @Post(':id/annuler')
  annuler(@Param('id') id: string, @Body() dto: MotifDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.annuler(actor, id, dto);
  }

  @Post(':id/prise-de-connaissance')
  prendreConnaissance(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.prendreConnaissance(actor, id);
  }

  @Post(':id/pieces')
  @UseInterceptors(FilesInterceptor('files', MAX_FICHIERS, OPTIONS_FICHIERS))
  ajouterPieces(@Param('id') id: string, @UploadedFiles() files: Express.Multer.File[] = [], @CurrentUser() actor: AuthenticatedUser) {
    return this.actes.ajouterPieces(actor, id, files ?? []);
  }

  @Get(':id/pieces/:pieceId/download')
  async telecharger(
    @Param('id') id: string,
    @Param('pieceId') pieceId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    return envoyerFichier(res, await this.actes.telechargerPiece(actor, id, pieceId));
  }

  @Get(':id/acces-delegues')
  listerAcces(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegues.lister(actor, { acteId: id });
  }

  @Post(':id/acces-delegues')
  ouvrirAcces(@Param('id') id: string, @Body() dto: OuvrirAccesDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.delegues.ouvrir(actor, { acteId: id }, dto.beneficiaireId);
  }
}
