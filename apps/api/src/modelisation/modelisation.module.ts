import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { ModelesController, ModelisationController } from './modelisation.controller';
import { ModelesService } from './modeles.service';
import { AffectationsModelisationService } from './affectations.service';
import { TravauxCalculService } from './travaux.service';
import { CalculClient } from './calcul.client';

/** Domaine B, lot B1 : référentiel des modèles, dépôt par paquet, service de calcul. */
@Module({
  imports: [CommunicationModule],
  controllers: [ModelesController, ModelisationController],
  providers: [ModelesService, AffectationsModelisationService, TravauxCalculService, CalculClient],
  exports: [ModelesService, CalculClient],
})
export class ModelisationModule {}
