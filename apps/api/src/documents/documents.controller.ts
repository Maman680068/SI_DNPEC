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
    return this.documentsService.create(actor, dto, file);
  }

  @Get()
  findAll(@Query() filters: DocumentFiltersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.findAllVisibleTo(actor, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.findOneVisibleTo(actor, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDocumentDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.update(actor, id, dto);
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
    return this.documentsService.addVersion(actor, id, file);
  }

  @Get(':id/versions/:versionId/download')
  async download(
    @Param('id') id: string,
    @Param('versionId') versionId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { version, stream } = await this.documentsService.downloadVersion(actor, id, versionId);
    res.set({
      'Content-Type': version.mimeType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(version.fileName)}"`,
    });
    return new StreamableFile(stream);
  }

  @Post(':id/mark-final')
  markFinal(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.markFinal(actor, id);
  }

  @Post(':id/publish')
  publish(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.documentsService.publish(actor, id);
  }
}
