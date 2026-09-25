import { BadRequestException, Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { PersonnelImportService } from './personnel-import.service';

const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

@Controller('personnel-files')
export class PersonnelImportController {
  constructor(private readonly importService: PersonnelImportService) {}

  @Roles(SystemRole.DRH)
  @Post('import')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: MAX_FILE_SIZE_BYTES } }))
  importExcel(@UploadedFile() file: Express.Multer.File | undefined, @CurrentUser() actor: AuthenticatedUser) {
    if (!file) throw new BadRequestException('Aucun fichier reçu.');
    return this.importService.importFromWorkbook(actor, file.buffer);
  }
}
