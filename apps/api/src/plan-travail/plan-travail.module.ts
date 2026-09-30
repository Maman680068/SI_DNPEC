import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { PlanTravailController } from './plan-travail.controller';
import { PlanTravailService } from './plan-travail.service';

/** Plan de travail (socle N5) : objectifs, activités, avancement calculé. */
@Module({
  imports: [CommunicationModule],
  controllers: [PlanTravailController],
  providers: [PlanTravailService],
  exports: [PlanTravailService],
})
export class PlanTravailModule {}
