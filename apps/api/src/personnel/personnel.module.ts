import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PersonnelFilesController } from './personnel-files.controller';
import { PersonnelFilesService } from './personnel-files.service';
import { PersonnelImportService } from './personnel-import.service';
import { PersonnelHistoryService } from './personnel-history.service';

@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [PersonnelFilesController],
  providers: [PersonnelFilesService, PersonnelImportService, PersonnelHistoryService],
  // PersonnelHistoryService exporté pour UsersModule (hook dans
  // UsersService.updateAssignment — voir users.service.ts).
  exports: [PersonnelHistoryService],
})
export class PersonnelModule {}
