import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { PlanTravailController } from './plan-travail.controller';
import { PlanTravailService } from './plan-travail.service';

/** Plan de travail (socle N5) : objectifs, activités, avancement calculé. */
@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [PlanTravailController],
  providers: [PlanTravailService],
  exports: [PlanTravailService],
})
export class PlanTravailModule {}
