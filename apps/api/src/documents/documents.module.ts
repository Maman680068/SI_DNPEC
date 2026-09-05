import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { FoldersController } from './folders/folders.controller';
import { FoldersService } from './folders/folders.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [OrgModule],
  controllers: [FoldersController, DocumentsController],
  providers: [FoldersService, DocumentsService],
})
export class DocumentsModule {}
