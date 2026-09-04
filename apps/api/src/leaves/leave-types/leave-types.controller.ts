import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
import { LeaveTypesService } from './leave-types.service';
import { CreateLeaveTypeDto } from '../dto/create-leave-type.dto';
import { UpdateLeaveTypeDto } from '../dto/update-leave-type.dto';

@Controller('leave-types')
export class LeaveTypesController {
  constructor(private readonly leaveTypesService: LeaveTypesService) {}

  @Get()
  findAll() {
    return this.leaveTypesService.findAll();
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Post()
  create(@Body() dto: CreateLeaveTypeDto) {
    return this.leaveTypesService.create(dto);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateLeaveTypeDto) {
    return this.leaveTypesService.update(id, dto);
  }
}
