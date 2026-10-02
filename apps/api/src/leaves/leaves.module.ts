import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { LeaveTypesController } from './leave-types/leave-types.controller';
import { LeaveTypesService } from './leave-types/leave-types.service';
import { LeaveRequestsController } from './leave-requests/leave-requests.controller';
import { LeaveRequestsService } from './leave-requests/leave-requests.service';
import { LeaveBalancesController } from './leave-balances/leave-balances.controller';
import { LeaveBalancesService } from './leave-balances/leave-balances.service';
import { LeaveMedicalPrivacyService } from './leave-medical-privacy.service';

@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [LeaveTypesController, LeaveRequestsController, LeaveBalancesController],
  providers: [LeaveTypesService, LeaveRequestsService, LeaveBalancesService, LeaveMedicalPrivacyService],
  // Tableau de bord par rôle (socle N6) : absences et demandes vues comme à l'écran des congés.
  exports: [LeaveRequestsService],
})
export class LeavesModule {}
