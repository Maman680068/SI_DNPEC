import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { GestionnairesLogistiqueService } from './gestionnaires.service';
import { ReferentielLogistiqueService } from './referentiel.service';
import { InventaireService } from './inventaire.service';
import { DemandesLogistiqueService } from './demandes.service';
import { ReservationsService } from './reservations.service';
import { LogistiqueController } from './logistique.controller';

@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [LogistiqueController],
  providers: [GestionnairesLogistiqueService, ReferentielLogistiqueService, InventaireService, DemandesLogistiqueService, ReservationsService],
  // ReservationsService : salle réservée depuis une réunion (MeetingsModule).
  exports: [GestionnairesLogistiqueService, ReservationsService],
})
export class LogistiqueModule {}
