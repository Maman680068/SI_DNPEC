import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PlanTravailModule } from '../plan-travail/plan-travail.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { EcheancesTachesService } from './echeances-taches.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';

@Module({
  imports: [OrgModule, CommunicationModule, PlanTravailModule],
  controllers: [TasksController, ProjectsController],
  providers: [TasksService, ProjectsService, EcheancesTachesService],
  exports: [TasksService],
})
export class TasksModule {}
