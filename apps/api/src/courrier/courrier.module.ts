import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { RegistresController } from './registres.controller';
import { ArriveesController } from './arrivees.controller';
import { RegistresService } from './registres.service';
import { NumerotationService } from './numerotation.service';
import { CourrierAccesService } from './courrier-acces.service';
import { ArriveesService } from './arrivees.service';
import { ImputationsService } from './imputations.service';
import { AccesDeleguesService } from './acces-delegues.service';

/** Courrier et actes (D7) — voir schema.prisma, section « Module Courrier et actes ». */
@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [RegistresController, ArriveesController],
  providers: [
    RegistresService,
    NumerotationService,
    CourrierAccesService,
    ArriveesService,
    ImputationsService,
    AccesDeleguesService,
  ],
})
export class CourrierModule {}
