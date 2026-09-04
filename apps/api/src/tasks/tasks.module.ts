import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';
import { ProjectsController } from './projects/projects.controller';
import { ProjectsService } from './projects/projects.service';

@Module({
  imports: [OrgModule],
  controllers: [TasksController, ProjectsController],
  providers: [TasksService, ProjectsService],
  exports: [TasksService],
})
export class TasksModule {}
