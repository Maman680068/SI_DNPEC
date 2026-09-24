import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { RegistresController } from './registres.controller';
import { RegistresService } from './registres.service';
import { NumerotationService } from './numerotation.service';

/** Courrier et actes (D7) — voir schema.prisma, section « Module Courrier et actes ». */
@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [RegistresController],
  providers: [RegistresService, NumerotationService],
})
export class CourrierModule {}
