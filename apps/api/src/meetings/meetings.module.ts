import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { LogistiqueModule } from '../logistique/logistique.module';
import { MeetingsController } from './meetings.controller';
import { MeetingsService } from './meetings.service';
import { DecisionsController } from './decisions.controller';
import { DecisionsService } from './decisions.service';

@Module({
  imports: [OrgModule, CommunicationModule, LogistiqueModule],
  controllers: [MeetingsController, DecisionsController],
  providers: [MeetingsService, DecisionsService],
  exports: [MeetingsService],
})
export class MeetingsModule {}
