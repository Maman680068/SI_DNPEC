import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { UsersModule } from '../users/users.module';
import { PersonnelImportController } from './personnel-import.controller';
import { PersonnelImportService } from './personnel-import.service';

/**
 * Import Excel du personnel, séparé de PersonnelModule : il crée des comptes
 * et doit donc passer par les contrôles de UsersService (rattachement, unités
 * actives, unicité des chefs), alors que UsersModule importe déjà
 * PersonnelModule (historique de carrière) — un module à part évite le cycle.
 */
@Module({
  imports: [UsersModule, CommunicationModule],
  controllers: [PersonnelImportController],
  providers: [PersonnelImportService],
})
export class PersonnelImportModule {}
