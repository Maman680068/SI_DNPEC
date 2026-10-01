import { Global, Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { OrgModule } from '../org/org.module';
import { UnitesArbreService } from './unites-arbre.service';
import { AutorisationService } from './autorisation.service';
import { ReprisesN1Service } from './reprise-n1.service';
import { RolesFonctionnelsService } from './roles-fonctionnels.service';
import { UnitesService } from './unites.service';
import { AgentsService } from './agents.service';
import { JoursFeriesService } from './jours-feries.service';
import { JoursFeriesController } from './jours-feries.controller';
import { SocleController } from './socle.controller';
import { ParametresService } from './parametres.service';
import { TachesPlanifieesService } from './taches-planifiees.service';
import { JournalConnexionsService } from './journal-connexions.service';
import { JournalAuditService } from './journal-audit.service';
import { PreuveIdentiteService } from './preuve-identite.service';
import { SupervisionService } from './supervision.service';
import { ConservationService } from './conservation.service';

/** Lot N2 : paramètres, tâches planifiées, connexions, journal d'audit, réauthentification, supervision. */
const SERVICES_N2 = [ParametresService, TachesPlanifieesService, JournalConnexionsService, JournalAuditService, PreuveIdentiteService, SupervisionService, ConservationService, JoursFeriesService];

/**
 * Socle NIMBA : organigramme, agents, habilitation à deux axes. Global : la
 * reprise (synchronisation après écriture historique), l'autorisation et les
 * reflets d'habilitation servent à de nombreux modules existants.
 */
@Global()
@Module({
  imports: [CommunicationModule, OrgModule],
  controllers: [SocleController, JoursFeriesController],
  providers: [UnitesArbreService, AutorisationService, ReprisesN1Service, RolesFonctionnelsService, UnitesService, AgentsService, ...SERVICES_N2],
  exports: [UnitesArbreService, AutorisationService, ReprisesN1Service, RolesFonctionnelsService, UnitesService, AgentsService, ...SERVICES_N2],
})
export class SocleModule {}
