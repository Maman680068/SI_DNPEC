import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { envoyerExcel } from '../courrier/fichiers';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { ReferentielLogistiqueService } from './referentiel.service';
import { InventaireService } from './inventaire.service';
import { DemandesLogistiqueService } from './demandes.service';
import {
  AffecterBienDto,
  ArticleDto,
  CreerBienDto,
  CreerCategorieDto,
  CreerDemandeDto,
  EtatBienDto,
  FiltresBiensDto,
  FiltresDemandesDto,
  HabilitationLogistiqueDto,
  ModifierArticleDto,
  ModifierBienDto,
  ModifierCategorieDto,
  MotifDto,
  MotifObligatoireDto,
  MouvementStockDto,
  TraiterDemandeDto,
} from './dto/logistique.dto';

/** Logistique (D9) : fermée aux stagiaires (aucune annotation @OuvertAuxStagiaires). */
@Controller('logistique')
export class LogistiqueController {
  constructor(
    private readonly gestionnaires: GestionnairesLogistiqueService,
    private readonly referentiel: ReferentielLogistiqueService,
    private readonly inventaire: InventaireService,
    private readonly demandes: DemandesLogistiqueService,
  ) {}

  @Get('tableau-de-bord')
  tableau(@CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.tableauDeBord(actor);
  }

  // ---------------------------------------------------------- Paramétrage

  @Get('categories')
  categories() {
    return this.referentiel.categories();
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get('categories/toutes')
  toutesCategories() {
    return this.referentiel.categories(true);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('categories')
  creerCategorie(@Body() dto: CreerCategorieDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.creerCategorie(actor, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch('categories/:id')
  modifierCategorie(@Param('id') id: string, @Body() dto: ModifierCategorieDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.modifierCategorie(actor, id, dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Get('habilitations')
  habilitations() {
    return this.gestionnaires.lister();
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('habilitations')
  accorder(@Body() dto: HabilitationLogistiqueDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.gestionnaires.accorder(actor, dto.userId);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post('habilitations/:id/revoquer')
  revoquer(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.gestionnaires.revoquer(actor, id);
  }

  // ---------------------------------------------------------- Fournitures

  @Get('articles')
  articles(@CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.articles(actor);
  }

  @Post('articles')
  creerArticle(@Body() dto: ArticleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.creerArticle(actor, dto);
  }

  @Patch('articles/:id')
  modifierArticle(@Param('id') id: string, @Body() dto: ModifierArticleDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.modifierArticle(actor, id, dto);
  }

  @Get('articles/:id/mouvements')
  mouvements(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.mouvements(actor, id);
  }

  @Post('articles/:id/mouvements')
  mouvement(@Param('id') id: string, @Body() dto: MouvementStockDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.referentiel.mouvement(actor, id, dto);
  }

  // ---------------------------------------------------------- Inventaire

  @Get('biens')
  biens(@Query() f: FiltresBiensDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.lister(actor, f);
  }

  @Get('biens/export.xlsx')
  async exporterBiens(@Query() f: FiltresBiensDto, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return envoyerExcel(res, await this.inventaire.exporter(actor, f), 'inventaire');
  }

  @Post('biens')
  creerBien(@Body() dto: CreerBienDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.creer(actor, dto);
  }

  @Get('biens/:id')
  bien(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.fiche(actor, id);
  }

  @Patch('biens/:id')
  modifierBien(@Param('id') id: string, @Body() dto: ModifierBienDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.modifier(actor, id, dto);
  }

  @Post('biens/:id/affecter')
  affecter(@Param('id') id: string, @Body() dto: AffecterBienDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.affecter(actor, id, dto);
  }

  @Post('biens/:id/retour')
  retour(@Param('id') id: string, @Body() dto: MotifDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.retour(actor, id, dto);
  }

  @Post('biens/:id/etat')
  etat(@Param('id') id: string, @Body() dto: EtatBienDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.inventaire.changerEtat(actor, id, dto);
  }

  // ---------------------------------------------------------- Demandes

  @Get('demandes')
  demandesListe(@Query() f: FiltresDemandesDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.lister(actor, f);
  }

  @Get('demandes/export.xlsx')
  async exporterDemandes(@Query() f: FiltresDemandesDto, @CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    return envoyerExcel(res, await this.demandes.exporter(actor, f), 'demandes_logistiques');
  }

  @Post('demandes')
  creerDemande(@Body() dto: CreerDemandeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.creer(actor, dto);
  }

  @Get('demandes/:id')
  demande(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.fiche(actor, id);
  }

  @Post('demandes/:id/valider')
  valider(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.valider(actor, id);
  }

  @Post('demandes/:id/refuser')
  refuser(@Param('id') id: string, @Body() dto: MotifObligatoireDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.refuser(actor, id, dto);
  }

  @Post('demandes/:id/prendre-en-charge')
  prendreEnCharge(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.prendreEnCharge(actor, id);
  }

  @Post('demandes/:id/traiter')
  traiter(@Param('id') id: string, @Body() dto: TraiterDemandeDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.traiter(actor, id, dto);
  }

  @Post('demandes/:id/annuler')
  annuler(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.demandes.annuler(actor, id);
  }
}
