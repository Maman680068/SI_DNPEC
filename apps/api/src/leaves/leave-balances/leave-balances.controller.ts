import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { LeaveBalancesService } from './leave-balances.service';
import { SetLeaveBalanceDto } from '../dto/set-leave-balance.dto';

@Controller('leaves/balances')
export class LeaveBalancesController {
  constructor(private readonly leaveBalancesService: LeaveBalancesService) {}

  @Get('me')
  listMine(@CurrentUser() actor: AuthenticatedUser) {
    return this.leaveBalancesService.listForUser(actor, actor.id);
  }

  @Get(':userId')
  listForUser(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveBalancesService.listForUser(actor, userId);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Put(':userId')
  setTotalDays(@Param('userId') userId: string, @Body() dto: SetLeaveBalanceDto) {
    return this.leaveBalancesService.setTotalDays(userId, dto);
  }
}
