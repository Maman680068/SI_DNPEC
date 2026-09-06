import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { EmailService } from './notifications/email.service';

@Module({
  imports: [OrgModule],
  controllers: [MessagesController, AnnouncementsController, NotificationsController],
  providers: [MessagesService, AnnouncementsService, NotificationsService, EmailService],
  // NotificationsService exporté pour être réutilisé par TasksModule
  // (notifications d'assignation, de mention, de soumission/validation/rejet).
  // EmailService exporté pour être réutilisé par AuthModule (email de
  // réinitialisation de mot de passe).
  exports: [NotificationsService, EmailService],
})
export class CommunicationModule {}
