import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { ReauthentificationDto } from './dto/reauth.dto';

/** Réauthentification (socle N2) : preuve d'identité courte avant un objet protégé. */
@Controller('api/v1')
export class ReauthController {
  constructor(private readonly auth: AuthService) {}

  @Post('reauthentification')
  @HttpCode(HttpStatus.OK)
  reauthentifier(@CurrentUser() actor: AuthenticatedUser, @Body() dto: ReauthentificationDto, @Req() req: Request) {
    return this.auth.reauthentifier(actor, dto, req.ip ?? 'unknown', req.headers['user-agent']);
  }
}
