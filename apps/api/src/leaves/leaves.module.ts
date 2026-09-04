import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { LeaveTypesController } from './leave-types/leave-types.controller';
import { LeaveTypesService } from './leave-types/leave-types.service';
import { LeaveRequestsController } from './leave-requests/leave-requests.controller';
import { LeaveRequestsService } from './leave-requests/leave-requests.service';
import { LeaveBalancesController } from './leave-balances/leave-balances.controller';
import { LeaveBalancesService } from './leave-balances/leave-balances.service';

@Module({
  imports: [OrgModule],
  controllers: [LeaveTypesController, LeaveRequestsController, LeaveBalancesController],
  providers: [LeaveTypesService, LeaveRequestsService, LeaveBalancesService],
})
export class LeavesModule {}
