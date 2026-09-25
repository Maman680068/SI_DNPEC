import { Controller, Get, Param, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { NotificationsService } from './notifications.service';
import { OuvertAuxStagiaires } from '../../common/decorators/ouvert-aux-stagiaires.decorator';

@OuvertAuxStagiaires()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.listForUser(actor.id);
  }

  @Get('unread-count')
  unreadCount(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.countUnread(actor.id);
  }

  @Patch('read-all')
  markAllRead(@CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markAllRead(actor.id);
  }

  @Patch(':id/read')
  markRead(@Param('id') id: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.notificationsService.markRead(actor.id, id);
  }
}
