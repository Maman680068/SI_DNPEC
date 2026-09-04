import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { LeaveRequestsService } from './leave-requests.service';
import { CreateLeaveRequestDto } from '../dto/create-leave-request.dto';
import { DecideLeaveRequestDto } from '../dto/decide-leave-request.dto';
import { RejectLeaveRequestDto } from '../dto/reject-leave-request.dto';
import { LeaveRequestFiltersDto } from '../dto/leave-request-filters.dto';

@Controller('leaves')
export class LeaveRequestsController {
  constructor(private readonly leaveRequestsService: LeaveRequestsService) {}

  @Post()
  create(@Body() dto: CreateLeaveRequestDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.create(actor, dto);
  }

  @Get()
  findAll(@Query() filters: LeaveRequestFiltersDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.findAllVisibleTo(actor, filters);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.findOneVisibleTo(actor, id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Body() dto: DecideLeaveRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.approve(actor, id, dto);
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Body() dto: RejectLeaveRequestDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.leaveRequestsService.reject(actor, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.leaveRequestsService.cancel(actor, id);
  }
}
