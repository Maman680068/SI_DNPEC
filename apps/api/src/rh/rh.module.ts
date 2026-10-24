import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { CourrierModule } from '../courrier/courrier.module';
import { FormationsProfilController, RhController } from './rh.controller';
import { FormationsService } from './formations.service';
import { EffectifsService } from './effectifs.service';
import { CarriereService } from './carriere.service';
import { ReferentielRhService } from './referentiel-rh.service';
import { DossiersSyntheseService } from './dossiers-synthese.service';

/** Ressources humaines du socle N6 : effectifs et alertes, carrière et actes, fiches de poste, formation (besoins et plan individuel). */
@Module({
  imports: [CommunicationModule, CourrierModule],
  controllers: [RhController, FormationsProfilController],
  providers: [EffectifsService, CarriereService, ReferentielRhService, DossiersSyntheseService, FormationsService],
  exports: [EffectifsService],
})
export class RhModule {}
