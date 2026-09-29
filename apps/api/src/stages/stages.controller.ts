import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Res, StreamableFile, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { IsString } from 'class-validator';
import { AttestationService, DocumentGenere } from './attestation.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { StagesService } from './stages.service';
import {
  AccepterPeriodeDto,
  CapaciteDto,
  CreerStageDto,
  EvaluationDto,
  FormatEvaluationDto,
  ModifierPeriodeDto,
  ModifierStageDto,
  MotifDto,
  PeriodeDto,
} from './dto/stage.dto';

class EncadrantDto {
  @IsString()
  userId!: string;
}

class ActeAttestationDto {
  @IsString()
  registreId!: string;
}

const fichierOptions = { storage: memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } };

/** Le stagiaire accède à son propre stage (le service n'accorde rien d'autre). */
@OuvertAuxStagiaires()
@Controller('stages')
export class StagesController {
  constructor(
    private readonly stages: StagesService,
    private readonly attestation: AttestationService,
  ) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.stages.list(actor);
  }

  @Get('planning')
  planning(@CurrentUser() actor: AuthenticatedUser, @Query('debut') debut?: string, @Query('fin') fin?: string) {
    return this.stages.planning(actor, debut, fin);
  }

  @Get('capacites')
  capacites(@CurrentUser() actor: AuthenticatedUser) {
    return this.stages.capacites(actor);
  }

  @Put('capacites')
  fixerCapacite(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CapaciteDto) {
    return this.stages.fixerCapacite(actor, dto);
  }

  // --- Attestation : modèle (DRH) — routes statiques avant « :id » ---

  @Get('stagiaires-disponibles')
  stagiairesDisponibles(@CurrentUser() actor: AuthenticatedUser) {
    return this.stages.stagiairesDisponibles(actor);
  }

  @Get('registres-attestation')
  registresAttestation(@CurrentUser() actor: AuthenticatedUser) {
    return this.attestation.registres(actor);
  }

  @Get('modele-attestation')
  modele(@CurrentUser() actor: AuthenticatedUser) {
    return this.attestation.modele(actor);
  }

  @Post('modele-attestation')
  @UseInterceptors(FileInterceptor('file', fichierOptions))
  importerModele(@CurrentUser() actor: AuthenticatedUser, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.attestation.importerModele(actor, file);
  }

  @Get('modele-attestation/fichier')
  async telechargerModele(@CurrentUser() actor: AuthenticatedUser, @Res({ passthrough: true }) res: Response) {
    const { fileName, stream } = await this.attestation.telechargerModele(actor);
    this.entetes(res, fileName, 'application/octet-stream');
    return new StreamableFile(stream);
  }

  @Post()
  creer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: CreerStageDto) {
    return this.stages.creer(actor, dto);
  }

  // Encadreur principal et rapport de stage (socle N3, SIG-RF-STG-05/11).
  @Get(':id/encadrants-possibles')
  encadrantsPossibles(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.encadrantsPossibles(actor, id);
  }

  @Post(':id/encadrant-principal')
  designerEncadrant(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: EncadrantDto) {
    return this.stages.designerEncadrant(actor, id, dto.userId);
  }

  @Post(':id/rapport')
  @UseInterceptors(FileInterceptor('file', fichierOptions))
  deposerRapport(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @UploadedFile() file: Express.Multer.File | undefined) {
    return this.stages.deposerRapport(actor, id, file);
  }

  @Get(':id/rapport')
  async telechargerRapport(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { fileName, stream } = await this.stages.telechargerRapport(actor, id);
    this.entetes(res, fileName, 'application/octet-stream');
    return new StreamableFile(stream);
  }

  @Post(':id/rapport/valider')
  validerRapport(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.validerRapport(actor, id);
  }

  @Post(':id/rapport/renvoyer')
  renvoyerRapport(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.stages.renvoyerRapport(actor, id, dto.motif);
  }

  @Get(':id')
  findOne(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.findOne(actor, id);
  }

  @Patch(':id')
  modifier(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ModifierStageDto) {
    return this.stages.modifier(actor, id, dto);
  }

  @Post(':id/cloturer')
  cloturer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    return this.stages.cloturer(actor, id);
  }

  @Post(':id/interrompre')
  interrompre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: MotifDto) {
    return this.stages.interrompre(actor, id, dto.motif);
  }

  // --- Attestation d'un stage ---

  @Get(':id/attestation/provisoire')
  async provisoire(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return this.envoyer(res, await this.attestation.provisoire(actor, id));
  }

  @Get(':id/attestation/document')
  async document(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    return this.envoyer(res, await this.attestation.document(actor, id));
  }

  @Post(':id/attestation/acte')
  creerActe(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: ActeAttestationDto) {
    return this.attestation.creerActe(actor, id, dto.registreId);
  }

  @Post(':id/attestation/prise-de-connaissance')
  async prendreConnaissance(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string) {
    await this.attestation.prendreConnaissance(actor, id);
    return this.stages.findOne(actor, id);
  }

  @Get(':id/attestation/finale')
  async finale(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const { fileName, stream } = await this.attestation.telechargerFinale(actor, id);
    this.entetes(res, fileName, 'application/octet-stream');
    return new StreamableFile(stream);
  }

  @Post(':id/periodes')
  ajouterPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: PeriodeDto) {
    return this.stages.ajouterPeriode(actor, id, dto);
  }

  @Patch(':id/periodes/:periodeId')
  modifierPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: ModifierPeriodeDto) {
    return this.stages.modifierPeriode(actor, id, periodeId, dto);
  }

  @Delete(':id/periodes/:periodeId')
  annulerPeriode(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.annulerPeriode(actor, id, periodeId);
  }

  @Get(':id/periodes/:periodeId/tuteurs-possibles')
  tuteursPossibles(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.tuteursPossibles(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/accepter')
  accepter(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: AccepterPeriodeDto) {
    return this.stages.accepter(actor, id, periodeId, dto.tuteurId);
  }

  @Post(':id/periodes/:periodeId/refuser')
  refuser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: MotifDto) {
    return this.stages.refuser(actor, id, periodeId, dto.motif);
  }

  @Post(':id/periodes/:periodeId/tuteur')
  changerTuteur(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: AccepterPeriodeDto) {
    return this.stages.changerTuteur(actor, id, periodeId, dto.tuteurId);
  }

  @Post(':id/periodes/:periodeId/format')
  changerFormat(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: FormatEvaluationDto) {
    return this.stages.changerFormat(actor, id, periodeId, dto.formatEvaluation);
  }

  @Put(':id/periodes/:periodeId/evaluation')
  enregistrerEvaluation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: EvaluationDto) {
    return this.stages.enregistrerEvaluation(actor, id, periodeId, dto);
  }

  @Post(':id/periodes/:periodeId/evaluation/soumettre')
  soumettre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.soumettreEvaluation(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/evaluation/viser')
  viser(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string) {
    return this.stages.viserEvaluation(actor, id, periodeId);
  }

  @Post(':id/periodes/:periodeId/evaluation/renvoyer')
  renvoyer(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Param('periodeId') periodeId: string, @Body() dto: MotifDto) {
    return this.stages.renvoyerEvaluation(actor, id, periodeId, dto.motif);
  }

  private entetes(res: Response, fileName: string, type: string) {
    res.set({ 'Content-Type': type, 'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"` });
  }

  private envoyer(res: Response, doc: DocumentGenere) {
    this.entetes(res, doc.fileName, doc.mimeType);
    return new StreamableFile(doc.buffer);
  }
}
