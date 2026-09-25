import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { UsersModule } from '../users/users.module';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { StagesRotationService } from './stages-rotation.service';

@Module({
  imports: [OrgModule, CommunicationModule, PersonnelModule, UsersModule],
  controllers: [StagesController],
  providers: [StagesService, StagesRotationService],
  exports: [StagesService],
})
export class StagesModule {}
