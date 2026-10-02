import { Body, Controller, Get, HttpCode, Param, Post, Res, StreamableFile } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { GenerateurService } from './generateur.service';
import { ProduireDto, TransmettreDto } from './dto/produire.dto';
import { AttestationTravailDto, OrdreMissionDto, RegistreDto } from './dto/actes-generes.dto';

/** Documents générés (socle N4, SIG-RF-DOC) — routes sous api/v1 (enveloppe d'erreur du socle). */
@Controller('api/v1')
export class GenerateurController {
  constructor(private readonly generateur: GenerateurService) {}

  @Get('documents-generes/catalogue')
  catalogue(@CurrentUser() actor: AuthenticatedUser) {
    return this.generateur.catalogue(actor);
  }

  /** Aperçu fidèle (le PDF qui sera imprimé), rien n'est enregistré. */
  @Post('documents-generes/apercu')
  @HttpCode(200)
  async apercu(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ProduireDto, @Res({ passthrough: true }) res: Response) {
    const f = await this.generateur.produire(actor, { ...dto, format: 'PDF' }, { enregistrer: false });
    res.set({ 'Content-Type': f.mimeType, 'Content-Disposition': `inline; filename="${encodeURIComponent(f.fileName)}"` });
    return new StreamableFile(f.buffer);
  }

  /** Téléchargement PDF ou Word : une édition d'un document signé est enregistrée (duplicata ensuite). */
  @Post('documents-generes/telecharger')
  @HttpCode(200)
  async telecharger(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ProduireDto, @Res({ passthrough: true }) res: Response) {
    const f = await this.generateur.produire(actor, dto, { enregistrer: true });
    res.set({ 'Content-Type': f.mimeType, 'Content-Disposition': `attachment; filename="${encodeURIComponent(f.fileName)}"`, ...(f.edition ? { 'X-Edition': String(f.edition) } : {}) });
    return new StreamableFile(f.buffer);
  }

  @Post('documents-generes/ged')
  deposer(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ProduireDto) {
    return this.generateur.deposerEnGed(actor, dto);
  }

  @Post('documents-generes/transmettre')
  transmettre(@CurrentUser() actor: AuthenticatedUser, @Body() dto: TransmettreDto) {
    return this.generateur.transmettre(actor, dto);
  }

  @Get('attestations-travail')
  attestations(@CurrentUser() actor: AuthenticatedUser) {
    return this.generateur.listeAttestations(actor);
  }

  @Post('attestations-travail')
  creerAttestation(@CurrentUser() actor: AuthenticatedUser, @Body() dto: AttestationTravailDto) {
    return this.generateur.creerAttestation(actor, dto.agentId);
  }

  @Post('attestations-travail/:id/acte')
  acteAttestation(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: RegistreDto) {
    return this.generateur.acteAttestation(actor, id, dto.registreId);
  }

  @Get('ordres-mission')
  ordres(@CurrentUser() actor: AuthenticatedUser) {
    return this.generateur.listeOrdres(actor);
  }

  @Post('ordres-mission')
  creerOrdre(@CurrentUser() actor: AuthenticatedUser, @Body() dto: OrdreMissionDto) {
    return this.generateur.creerOrdre(actor, dto);
  }

  @Post('ordres-mission/:id/acte')
  acteOrdre(@CurrentUser() actor: AuthenticatedUser, @Param('id') id: string, @Body() dto: RegistreDto) {
    return this.generateur.acteOrdre(actor, id, dto.registreId);
  }
}
