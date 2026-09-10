import { Module } from '@nestjs/common';
import { TasksModule } from '../tasks/tasks.module';
import { UsersModule } from '../users/users.module';
import { ExportController } from './export.controller';
import { ExportService } from './export.service';

@Module({
  imports: [TasksModule, UsersModule],
  controllers: [ExportController],
  providers: [ExportService],
})
export class ExportModule {}
