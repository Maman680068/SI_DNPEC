import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { CourrierModule } from '../courrier/courrier.module';
import { RhController } from './rh.controller';
import { EffectifsService } from './effectifs.service';
import { CarriereService } from './carriere.service';
import { ReferentielRhService } from './referentiel-rh.service';

/** Ressources humaines du socle N6 : effectifs et alertes, carrière et actes, fiches de poste, formation. */
@Module({
  imports: [CommunicationModule, CourrierModule],
  controllers: [RhController],
  providers: [EffectifsService, CarriereService, ReferentielRhService],
  exports: [EffectifsService],
})
export class RhModule {}
