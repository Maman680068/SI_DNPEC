import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';

@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [TasksController, ProjectsController],
  providers: [TasksService, ProjectsService],
  exports: [TasksService],
})
export class TasksModule {}
