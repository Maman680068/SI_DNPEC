import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import type { ReadStream } from 'fs';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PersonnelFilesService } from './personnel-files.service';
import { UpdatePersonnelBasicDto } from './dto/update-personnel-basic.dto';
import { UpdatePersonnelSensitiveDto } from './dto/update-personnel-sensitive.dto';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { CreatePersonnelDocumentDto } from './dto/create-personnel-document.dto';
import { ReportPersonnelErrorDto } from './dto/report-personnel-error.dto';
import { OuvertAuxStagiaires } from '../common/decorators/ouvert-aux-stagiaires.decorator';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const fileInterceptorOptions = { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } };

@OuvertAuxStagiaires()
@Controller('personnel-files')
export class PersonnelFilesController {
  constructor(private readonly filesService: PersonnelFilesService) {}

  // Route statique déclarée avant ":userId" pour ne pas être capturée par lui
  // (même précaution que UsersController pour /pending, /resolve, /search...).
  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.list(actor);
  }

  @Get('me')
  getMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.getFile(actor, actor.id);
  }

  @Get(':userId')
  getOne(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.getFile(actor, userId);
  }

  @Patch(':userId/basic')
  updateBasic(
    @Param('userId') userId: string,
    @Body() dto: UpdatePersonnelBasicDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.updateBasic(actor, userId, dto);
  }

  @Post(':userId/job-description')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  setJobDescription(
    @Param('userId') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.setJobDescription(actor, userId, file);
  }

  @Get(':userId/job-description')
  async downloadJobDescription(
    @Param('userId') userId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { fileName, stream } = await this.filesService.downloadJobDescription(actor, userId);
    return this.fichier(res, fileName, stream);
  }

  @Patch(':userId/sensitive')
  updateSensitive(
    @Param('userId') userId: string,
    @Body() dto: UpdatePersonnelSensitiveDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.updateSensitive(actor, userId, dto);
  }

  @Post(':userId/diplomas')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  addDiploma(
    @Param('userId') userId: string,
    @Body() dto: CreateDiplomaDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.addDiploma(actor, userId, dto, file);
  }

  @Get(':userId/diplomas/:diplomaId/download')
  async downloadDiploma(
    @Param('userId') userId: string,
    @Param('diplomaId') diplomaId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { fileName, stream } = await this.filesService.downloadDiploma(actor, userId, diplomaId);
    return this.fichier(res, fileName, stream);
  }

  @Delete(':userId/diplomas/:diplomaId')
  removeDiploma(
    @Param('userId') userId: string,
    @Param('diplomaId') diplomaId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.removeDiploma(actor, userId, diplomaId);
  }

  @Post(':userId/documents')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  addDocument(
    @Param('userId') userId: string,
    @Body() dto: CreatePersonnelDocumentDto,
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.addDocument(actor, userId, dto, file);
  }

  @Delete(':userId/documents/:documentId')
  removeDocument(
    @Param('userId') userId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.removeDocument(actor, userId, documentId);
  }

  @Get(':userId/documents/:documentId/download')
  async download(
    @Param('userId') userId: string,
    @Param('documentId') documentId: string,
    @CurrentUser() actor: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    const { document, stream } = await this.filesService.downloadDocument(actor, userId, documentId);
    return this.fichier(res, document.fileName, stream);
  }

  @Get(':userId/career-history')
  getCareerHistory(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.getCareerHistory(actor, userId);
  }

  @Post(':userId/confirm')
  confirm(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.confirmMyInformation(actor, userId);
  }

  @Post(':userId/report-error')
  reportError(
    @Param('userId') userId: string,
    @Body() dto: ReportPersonnelErrorDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.filesService.reportError(actor, userId, dto);
  }

  private fichier(res: Response, fileName: string, stream: ReadStream): StreamableFile {
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
    });
    return new StreamableFile(stream);
  }
}
