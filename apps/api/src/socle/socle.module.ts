import { Global, Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { UnitesArbreService } from './unites-arbre.service';
import { AutorisationService } from './autorisation.service';
import { ReprisesN1Service } from './reprise-n1.service';
import { RolesFonctionnelsService } from './roles-fonctionnels.service';
import { UnitesService } from './unites.service';
import { AgentsService } from './agents.service';
import { SocleController } from './socle.controller';

/**
 * Socle NIMBA : organigramme, agents, habilitation à deux axes. Global : la
 * reprise (synchronisation après écriture historique), l'autorisation et les
 * reflets d'habilitation servent à de nombreux modules existants.
 */
@Global()
@Module({
  imports: [CommunicationModule],
  controllers: [SocleController],
  providers: [UnitesArbreService, AutorisationService, ReprisesN1Service, RolesFonctionnelsService, UnitesService, AgentsService],
  exports: [UnitesArbreService, AutorisationService, ReprisesN1Service, RolesFonctionnelsService, UnitesService, AgentsService],
})
export class SocleModule {}
