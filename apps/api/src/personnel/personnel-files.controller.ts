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
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PersonnelFilesService } from './personnel-files.service';
import { PersonnelImportService } from './personnel-import.service';
import { UpdatePersonnelBasicDto } from './dto/update-personnel-basic.dto';
import { UpdatePersonnelSensitiveDto } from './dto/update-personnel-sensitive.dto';
import { CreateDiplomaDto } from './dto/create-diploma.dto';
import { CreatePersonnelDocumentDto } from './dto/create-personnel-document.dto';
import { ReportPersonnelErrorDto } from './dto/report-personnel-error.dto';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;
const fileInterceptorOptions = { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } };

@Controller('personnel-files')
export class PersonnelFilesController {
  constructor(
    private readonly filesService: PersonnelFilesService,
    private readonly importService: PersonnelImportService,
  ) {}

  // Route statique déclarée avant ":userId" pour ne pas être capturée par lui
  // (même précaution que UsersController pour /pending, /resolve, /search...).
  @Get('me')
  getMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.filesService.getFile(actor, actor.id);
  }

  @Roles(SystemRole.DRH)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', fileInterceptorOptions))
  importExcel(@UploadedFile() file: Express.Multer.File, @CurrentUser() actor: AuthenticatedUser) {
    return this.importService.importFromWorkbook(actor, file.buffer);
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
    res.set({
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${encodeURIComponent(document.fileName)}"`,
    });
    return new StreamableFile(stream);
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
}
