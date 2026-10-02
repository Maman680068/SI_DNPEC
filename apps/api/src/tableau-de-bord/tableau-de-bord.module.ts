import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { LeavesModule } from '../leaves/leaves.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { InstructionsModule } from '../instructions/instructions.module';
import { PlanTravailModule } from '../plan-travail/plan-travail.module';
import { RhModule } from '../rh/rh.module';
import { TableauDeBordController } from './tableau-de-bord.controller';
import { TableauDeBordService } from './tableau-de-bord.service';

/** Tableau de bord par rôle (socle N6, SIG-RF-TDB). */
@Module({
  imports: [TasksModule, LeavesModule, MeetingsModule, InstructionsModule, PlanTravailModule, RhModule],
  controllers: [TableauDeBordController],
  providers: [TableauDeBordService],
})
export class TableauDeBordModule {}
