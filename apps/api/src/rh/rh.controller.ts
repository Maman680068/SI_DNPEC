import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { envoyerExcel } from '../courrier/fichiers';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { EffectifsService } from './effectifs.service';
import { CarriereService } from './carriere.service';
import { ReferentielRhService } from './referentiel-rh.service';
import { DossiersSyntheseService } from './dossiers-synthese.service';
import {
  AnneeQueryDto,
  BesoinFormationDto,
  FamilleRegistreDto,
  FichePosteDto,
  ModifierPieceRequiseDto,
  MouvementDto,
  PieceRequiseDto,
  StatutBesoinDto,
} from './dto/rh.dto';

/** Ressources humaines (socle N6) — routes sous api/v1/rh. */
@Controller('api/v1/rh')
export class RhController {
  constructor(
    private readonly effectifs: EffectifsService,
    private readonly carriere: CarriereService,
    private readonly referentiel: ReferentielRhService,
    private readonly dossiers: DossiersSyntheseService,
  ) {}

  @Get()
  onglets(@CurrentUser() actor: AuthenticatedUser) {
    return this.effectifs.onglets(actor);
  }

  @Get('effectifs')
  lireEffectifs(@CurrentUser() actor: AuthenticatedUser) {
    return this.effectifs.effectifs(actor);
  }

  /** Export Excel des effectifs (agrégats de l'écran, même périmètre : DRH, DN, DNA). */
  @Get('effectifs/export.xlsx')
  async exporterEffectifs(@CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return envoyerExcel(res, await this.effectifs.exporterEffectifs(actor), 'effectifs');
  }

  /** Dossier du personnel, vue du DRH : bande de compteurs et lignes (complétude, alertes) — lecture, DRH seul. */
  @Get('dossiers')
  dossiersSynthese(@CurrentUser() actor: AuthenticatedUser) {
    return this.dossiers.synthese(actor);
  }

  @Get('alertes')
  alertes(@CurrentUser() actor: AuthenticatedUser) {
    return this.effectifs.alertes(actor);
  }

  @Get('pieces-requises')
  pieces(@CurrentUser() actor: AuthenticatedUser) {
    return this.effectifs.piecesRequises(actor);
  }

  @Post('pieces-requises')
  creerPiece(@CurrentUser() actor: AuthenticatedUser, @Body() dto: PieceRequiseDto) {
    return this.effectifs.creerPiece(actor, dto);
  }

  @Patch('pieces-requises/:id')
  modifierPiece(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierPieceRequiseDto) {
    return this.effectifs.modifierPiece(actor, id, dto);
  }

  @Get('familles-actes')
  familles(@CurrentUser() actor: AuthenticatedUser) {
    return this.carriere.familles(actor);
  }

  @Patch('familles-actes/:code')
  choisirRegistre(@CurrentUser() actor: AuthenticatedUser, @Param('code') code: string, @Body() dto: FamilleRegistreDto) {
    return this.carriere.choisirRegistre(actor, code, dto);
  }

  @Get('mouvements')
  mouvements(@CurrentUser() actor: AuthenticatedUser, @Query('userId') userId?: string) {
    return this.carriere.liste(actor, userId);
  }

  @Post('mouvements')
  preparer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: MouvementDto) {
    return this.carriere.preparer(actor, dto);
  }

  @Post('mouvements/:id/acte')
  preparerActe(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.carriere.preparerActe(actor, id);
  }

  @Post('mouvements/:id/annulation')
  @HttpCode(200)
  annuler(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.carriere.annuler(actor, id);
  }

  @Get('fiches-poste')
  fiches(@CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.fiches(actor);
  }

  @Post('fiches-poste')
  creerFiche(@CurrentUser() actor: AuthenticatedUser, @Body() dto: FichePosteDto) {
    return this.referentiel.enregistrerFiche(actor, dto);
  }

  @Patch('fiches-poste/:id')
  modifierFiche(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: FichePosteDto) {
    return this.referentiel.enregistrerFiche(actor, dto, id);
  }

  @Get('formation')
  besoins(@CurrentUser() actor: AuthenticatedUser, @Query() q: AnneeQueryDto) {
    return this.referentiel.besoins(actor, q.annee ?? new Date().getUTCFullYear());
  }

  @Post('formation')
  exprimer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: BesoinFormationDto) {
    return this.referentiel.exprimer(actor, dto);
  }

  @Patch('formation/:id/statut')
  statutBesoin(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: StatutBesoinDto) {
    return this.referentiel.changerStatut(actor, id, dto);
  }
}
