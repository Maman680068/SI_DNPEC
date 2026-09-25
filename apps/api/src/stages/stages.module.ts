import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { UsersModule } from '../users/users.module';
import { CourrierModule } from '../courrier/courrier.module';
import { AttestationService } from './attestation.service';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { StagesRotationService } from './stages-rotation.service';

@Module({
  imports: [OrgModule, CommunicationModule, PersonnelModule, UsersModule, CourrierModule],
  controllers: [StagesController],
  providers: [StagesService, StagesRotationService, AttestationService],
  exports: [StagesService],
})
export class StagesModule {}
