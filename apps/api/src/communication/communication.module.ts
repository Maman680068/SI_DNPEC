import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { MessagesController } from './messages/messages.controller';
import { MessagesService } from './messages/messages.service';
import { AnnouncementsController } from './announcements/announcements.controller';
import { AnnouncementsService } from './announcements/announcements.service';
import { PollsController } from './polls/polls.controller';
import { PollsService } from './polls/polls.service';
import { NotificationsController } from './notifications/notifications.controller';
import { NotificationsService } from './notifications/notifications.service';
import { EmailService } from './notifications/email.service';
import { ResumeQuotidienService } from './notifications/resume-quotidien.service';
import { PreferencesNotificationController } from './notifications/preferences-notification.controller';

@Module({
  imports: [OrgModule],
  controllers: [MessagesController, AnnouncementsController, PollsController, NotificationsController, PreferencesNotificationController],
  providers: [MessagesService, AnnouncementsService, PollsService, NotificationsService, EmailService, ResumeQuotidienService],
  // NotificationsService exporté pour être réutilisé par TasksModule
  // (notifications d'assignation, de mention, de soumission/validation/rejet).
  // EmailService exporté pour être réutilisé par AuthModule (email de
  // réinitialisation de mot de passe).
  exports: [NotificationsService, EmailService, MessagesService],
})
export class CommunicationModule {}
