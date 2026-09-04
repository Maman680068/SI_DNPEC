import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { AnnouncementsService } from './announcements.service';
import { CreateAnnouncementDto } from '../dto/create-announcement.dto';

@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcementsService: AnnouncementsService) {}

  @Post()
  create(@Body() dto: CreateAnnouncementDto, @CurrentUser() actor: AuthenticatedUser) {
    return this.announcementsService.create(actor, dto);
  }

  @Get()
  findAll(@CurrentUser() actor: AuthenticatedUser) {
    return this.announcementsService.findAllVisibleTo(actor);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.announcementsService.findOneVisibleTo(actor, id);
  }

  @Post(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.announcementsService.markRead(actor, id);
  }

  @Get(':id/reads')
  listReads(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.announcementsService.listReads(actor, id);
  }
}
