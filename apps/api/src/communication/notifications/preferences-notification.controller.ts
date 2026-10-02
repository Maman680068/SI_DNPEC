import { Body, Controller, Get, Patch } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../../common/types/auth-user.type';
import { OuvertAuxStagiaires } from '../../common/decorators/ouvert-aux-stagiaires.decorator';
import { ResumeQuotidienService } from './resume-quotidien.service';
import { PreferencesNotificationDto } from './dto/preferences.dto';

/** Préférences de notification de l'agent connecté (socle N5) : jugées sur `actor.id`, jamais empruntées en intérim. */
@OuvertAuxStagiaires()
@Controller('api/v1/notifications/preferences')
export class PreferencesNotificationController {
  constructor(private readonly resume: ResumeQuotidienService) {}

  @Get()
  lire(@CurrentUser() actor: AuthenticatedUser) {
    return this.resume.preferences(actor.id);
  }

  @Patch()
  modifier(@CurrentUser() actor: AuthenticatedUser, @Body() dto: PreferencesNotificationDto) {
    return this.resume.modifier(actor.id, dto);
  }
}
