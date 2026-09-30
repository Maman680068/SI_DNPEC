import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { CourrierModule } from '../courrier/courrier.module';
import { TasksModule } from '../tasks/tasks.module';
import { DocumentsModule } from '../documents/documents.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { GenerateurController } from './generateur.controller';
import { GenerateurService } from './generateur.service';

/** Documents générés (socle N4) : attestation de travail, ordre de mission, rapport d'activité. */
@Module({
  imports: [OrgModule, CommunicationModule, CourrierModule, TasksModule, DocumentsModule, PersonnelModule],
  controllers: [GenerateurController],
  providers: [GenerateurService],
})
export class GenerateurModule {}
