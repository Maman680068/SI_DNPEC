import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { RegistresController } from './registres.controller';
import { ArriveesController } from './arrivees.controller';
import { ActesController } from './actes.controller';
import { RegistresService } from './registres.service';
import { NumerotationService } from './numerotation.service';
import { CourrierAccesService } from './courrier-acces.service';
import { ArriveesService } from './arrivees.service';
import { ImputationsService } from './imputations.service';
import { AccesDeleguesService } from './acces-delegues.service';
import { ActesService } from './actes.service';
import { CourrierRappelsService } from './rappels.service';
import { CourrierExportService } from './courrier-export.service';
import { CourrierTableauDeBordService } from './tableau-de-bord.service';

/** Courrier et actes (D7) — voir schema.prisma, section « Module Courrier et actes ». */
@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [RegistresController, ArriveesController, ActesController],
  providers: [
    RegistresService,
    NumerotationService,
    CourrierAccesService,
    ArriveesService,
    ImputationsService,
    AccesDeleguesService,
    ActesService,
    CourrierRappelsService,
    CourrierExportService,
    CourrierTableauDeBordService,
  ],
})
export class CourrierModule {}
