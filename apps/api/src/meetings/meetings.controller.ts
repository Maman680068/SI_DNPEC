import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { MeetingsService } from './meetings.service';
import { CreateMeetingDto } from './dto/create-meeting.dto';
import { RespondMeetingDto } from './dto/respond-meeting.dto';
import { CancelMeetingDto } from './dto/cancel-meeting.dto';
import { UpdateMeetingDto } from './dto/update-meeting.dto';

@Controller('meetings')
export class MeetingsController {
  constructor(private readonly meetingsService: MeetingsService) {}

  @Post()
  create(@Body() dto: CreateMeetingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.create(actor, dto);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.findAllVisibleTo(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.findOneVisibleTo(actor, id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateMeetingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.update(actor, id, dto);
  }

  @Patch(':id/respond')
  respond(@Param('id') id: string, @Body() dto: RespondMeetingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.respond(actor, id, dto);
  }

  @Post(':id/cancel')
  cancel(@Param('id') id: string, @Body() dto: CancelMeetingDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.meetingsService.cancel(actor, id, dto);
  }
}
