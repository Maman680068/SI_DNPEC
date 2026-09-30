import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { UpdateDocumentDto } from './dto/update-document.dto';
import { DocumentFiltersDto } from './dto/document-filters.dto';
import { StatutDocumentDto } from './dto/statut-document.dto';

// 25 Mo — plafond raisonnable pour des documents de travail (études, rapports,
// notes techniques) sur un stockage disque local (voir StorageService).
const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const fileInterceptorOptions = { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } };

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  create(
    @Body() dto: CreateDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documentsService.create(actor, dto, file).then((d) => this.documentsService.presenter(actor, d));
  }

  @Get()
  findAll(@Query() filters: DocumentFiltersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.findAllVisibleTo(actor, filters).then((ds) => Promise.all(ds.map((d) => this.documentsService.presenter(actor, d))));
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.findOneVisibleTo(actor, id).then((d) => this.documentsService.presenter(actor, d));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.update(actor, id, dto).then((d) => this.documentsService.presenter(actor, d));
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.listVersions(actor, id);
  }

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  addVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.documentsService.addVersion(actor, id, file).then((d) => this.documentsService.presenter(actor, d));
  }

  /** Copie marquée du statut de diffusion (service d'export unique, socle N4). */
  @Get(':id/versions/:versionId/download')
  async download(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const f = await this.documentsService.downloadVersion(actor, id, versionId);
    res.set({
      'Content-Type': f.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(f.fileName)}"`,
      'X-Statut-Diffusion': f.statut,
    });
    return new StreamableFile(f.buffer);
  }

  @Post(':id/mark-final')
  markFinal(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.markFinal(actor, id).then((d) => this.documentsService.presenter(actor, d));
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.publish(actor, id).then((d) => this.documentsService.presenter(actor, d));
  }

  /** Statut de diffusion (§7.1) : valider, rendre diffusable, retirer (motif). */
  @Post(':id/statut')
  changerStatut(@Param('id') id: string, @Body() dto: StatutDocumentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.changerStatut(actor, id, dto).then((d) => this.documentsService.presenter(actor, d));
  }

  @Get(':id/statut')
  historiqueStatut(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.historiqueStatut(actor, id);
  }
}
