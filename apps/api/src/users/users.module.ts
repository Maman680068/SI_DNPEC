import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { ComptesSyntheseController, UsersController } from './users.controller';
import { ComptesSyntheseService } from './comptes-synthese.service';
import { UsersService } from './users.service';
import { ComptesEmailsService } from './comptes-emails.service';

@Module({
  // PersonnelModule : UsersService.updateAssignment enregistre un événement
  // de carrière (AFFECTATION) via PersonnelHistoryService — voir
  // schema.prisma, PersonnelCareerEvent. Sens unique (PersonnelModule
  // n'importe jamais UsersModule) pour éviter tout cycle avec AuthModule.
  // CommunicationModule : EmailService, pour les emails de compte (ComptesEmailsService).
  imports: [OrgModule, PersonnelModule, CommunicationModule],
  controllers: [UsersController, ComptesSyntheseController],
  providers: [UsersService, ComptesEmailsService, ComptesSyntheseService],
  // ComptesEmailsService : aussi utilisé par les stages (compte stagiaire créé avec son stage).
  exports: [UsersService, ComptesEmailsService],
})
export class UsersModule {}
