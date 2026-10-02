import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { TasksModule } from '../tasks/tasks.module';
import { MeetingsModule } from '../meetings/meetings.module';
import { FoldersController } from './folders/folders.controller';
import { FoldersService } from './folders/folders.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [OrgModule, TasksModule, MeetingsModule],
  controllers: [FoldersController, DocumentsController],
  providers: [FoldersService, DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
