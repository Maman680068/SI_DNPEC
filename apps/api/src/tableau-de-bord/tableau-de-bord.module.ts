import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { LeavesModule } from '../leaves/leaves.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { InstructionsModule } from '../instructions/instructions.module';
import { PlanTravailModule } from '../plan-travail/plan-travail.module';
import { RhModule } from '../rh/rh.module';
import { CourrierModule } from '../courrier/courrier.module';
import { LogistiqueModule } from '../logistique/logistique.module';
import { CommunicationModule } from '../communication/communication.module';
import { StagesModule } from '../stages/stages.module';
import { TableauDeBordController } from './tableau-de-bord.controller';
import { NavigationController } from './navigation.controller';
import { NavigationService } from './navigation.service';
import { TableauDeBordService } from './tableau-de-bord.service';
import { ChiffresTableauService } from './chiffres.service';

/** Tableau de bord par rôle (socle N6, SIG-RF-TDB) et compteurs de navigation (refonte de l'interface). */
@Module({
  imports: [TasksModule, LeavesModule, MeetingsModule, InstructionsModule, PlanTravailModule, RhModule, CourrierModule, LogistiqueModule, CommunicationModule, StagesModule],
  controllers: [TableauDeBordController, NavigationController],
  providers: [TableauDeBordService, NavigationService, ChiffresTableauService],
})
export class TableauDeBordModule {}
