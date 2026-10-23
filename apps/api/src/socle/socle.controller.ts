import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { SauvegardeFichiersService } from './sauvegarde-fichiers.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { UnitesService } from './unites.service';
import { AgentsService } from './agents.service';
import { RolesFonctionnelsService } from './roles-fonctionnels.service';
import { CreerUniteDto, FermerUniteDto, ModifierUniteDto } from './dto/unites.dto';
import { CreerAgentDto, DepartDto, ListerAgentsDto, ModifierAgentDto, MotifDto, ProlongerDto, ReactiverDto } from './dto/agents.dto';
import { AttribuerRoleDto, ListerAttributionsDto, RetirerRoleDto } from './dto/attributions.dto';
import { FiltresAuditDto, ModifierParametreDto, TestRestaurationDto } from './dto/securite.dto';
import { ParametresService } from './parametres.service';
import { SupervisionService } from './supervision.service';
import { IndicateursSuccesService } from './indicateurs-succes.service';
import { JournalAuditService } from './journal-audit.service';

/**
 * Socle NIMBA (lot N1) — nouvelles routes aux conventions NIMBA (§11.4) :
 * préfixe /api/v1, enveloppe d'erreur { code, message, details, trace_id }.
 * Contrôleur mince : toute l'autorisation est dans les services (§5.5).
 */
@Controller('api/v1')
export class SocleController {
  constructor(
    private readonly unites: UnitesService,
    private readonly agents: AgentsService,
    private readonly roles: RolesFonctionnelsService,
    private readonly parametres: ParametresService,
    private readonly supervision: SupervisionService,
    private readonly journalAudit: JournalAuditService,
    private readonly sauvegarde: SauvegardeFichiersService,
    private readonly indicateurs: IndicateursSuccesService,
  ) {}

  // Paramétrage et supervision (lot N2, §13.6, SOC-SUP)
  @Get('parametres')
  listerParametres(@CurrentUser() u: AuthenticatedUser) {
    return this.parametres.lister(u);
  }

  @Patch('parametres/:cle')
  modifierParametre(@CurrentUser() u: AuthenticatedUser, @Param('cle') cle: string, @Body() dto: ModifierParametreDto) {
    return this.parametres.modifier(u, cle, dto.valeur);
  }

  /** Indicateurs de succès : calculés à la lecture (administrateur, DN, DNA) ; cibles par `PATCH parametres/:cle`. */
  @Get('indicateurs-succes')
  indicateursSucces(@CurrentUser() u: AuthenticatedUser) {
    return this.indicateurs.lire(u);
  }

  @Get('supervision')
  supervisionTableau(@CurrentUser() u: AuthenticatedUser) {
    return this.supervision.tableau(u);
  }

  // Sauvegarde du stockage des fichiers (exploitation 2026-10) : administrateur, mot de passe confirmé.
  @Get('supervision/sauvegarde-fichiers')
  inventaireFichiers(@CurrentUser() u: AuthenticatedUser) {
    return this.sauvegarde.inventaire(u);
  }

  @Get('supervision/sauvegarde-fichiers/archive')
  async archiveFichiers(@CurrentUser() u: AuthenticatedUser, @Res() res: Response) {
    await this.sauvegarde.telecharger(u, res);
  }

  @Post('supervision/test-restauration')
  declarerTestRestauration(@CurrentUser() u: AuthenticatedUser, @Body() dto: TestRestaurationDto) {
    return this.parametres.declarerTestRestauration(u, dto);
  }

  // Journal d'audit (lot N2, SOC-SEC-04, annexe 1)
  @Get('journal-audit')
  journal(@CurrentUser() u: AuthenticatedUser, @Query() f: FiltresAuditDto) {
    return this.journalAudit.lister(u, f);
  }

  @Get('journal-audit/verification')
  verifierJournal(@CurrentUser() u: AuthenticatedUser) {
    return this.journalAudit.verifier(u);
  }

  // Organigramme (§3)
  @Get('organigramme')
  organigramme(@CurrentUser() u: AuthenticatedUser) {
    return this.unites.organigramme(u);
  }

  @Post('unites')
  creerUnite(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreerUniteDto) {
    return this.unites.creer(u, dto);
  }

  @Patch('unites/:id')
  modifierUnite(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierUniteDto) {
    return this.unites.modifier(u, id, dto);
  }

  @Post('unites/:id/fermeture')
  fermerUnite(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: FermerUniteDto) {
    return this.unites.fermer(u, id, dto);
  }

  @Get('unites/:id/historique')
  historiqueUnite(@Param('id') id: string) {
    return this.unites.historique(id);
  }

  // Agents (§4, §6)
  @Get('agents')
  listerAgents(@CurrentUser() u: AuthenticatedUser, @Query() f: ListerAgentsDto) {
    return this.agents.lister(u, f);
  }

  @Get('agents/reprise')
  pointsDeReprise(@CurrentUser() u: AuthenticatedUser) {
    return this.agents.pointsDeReprise(u);
  }

  @Get('agents/:id')
  agent(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.agents.detail(u, id);
  }

  @Post('agents')
  creerAgent(@CurrentUser() u: AuthenticatedUser, @Body() dto: CreerAgentDto) {
    return this.agents.creer(u, dto);
  }

  @Patch('agents/:id')
  modifierAgent(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierAgentDto) {
    return this.agents.modifier(u, id, dto);
  }

  @Post('agents/:id/suspension')
  suspendre(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.agents.suspendre(u, id, dto);
  }

  @Post('agents/:id/reactivation')
  reactiver(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ReactiverDto) {
    return this.agents.reactiver(u, id, dto);
  }

  @Post('agents/:id/depart')
  depart(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: DepartDto) {
    return this.agents.depart(u, id, dto);
  }

  @Post('agents/:id/prolongation')
  prolonger(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: ProlongerDto) {
    return this.agents.prolonger(u, id, dto);
  }

  @Post('agents/:id/confirmation-fin')
  confirmerFin(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string) {
    return this.agents.confirmerFin(u, id);
  }

  // Rôles fonctionnels (§5.2)
  @Get('attributions-roles')
  listerAttributions(@CurrentUser() u: AuthenticatedUser, @Query() f: ListerAttributionsDto) {
    return this.roles.lister(u, f);
  }

  @Get('attributions-roles/candidats')
  candidats(@CurrentUser() u: AuthenticatedUser) {
    return this.roles.candidats(u);
  }

  @Post('attributions-roles')
  attribuer(@CurrentUser() u: AuthenticatedUser, @Body() dto: AttribuerRoleDto) {
    return this.roles.attribuer(u, dto);
  }

  @Post('attributions-roles/:id/retrait')
  retirer(@CurrentUser() u: AuthenticatedUser, @Param('id') id: string, @Body() dto: RetirerRoleDto) {
    return this.roles.retirer(u, id, dto);
  }
}
