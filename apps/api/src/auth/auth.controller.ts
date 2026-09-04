import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { SessionService } from './services/session.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { LoginTwoFaDto } from './dto/login-2fa.dto';
import { EnableTwoFaDto } from './dto/enable-2fa.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

function clientIp(req: Request): string {
  return req.ip ?? 'unknown';
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly sessionService: SessionService,
    private readonly usersService: UsersService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() dto: RegisterDto, @Req() req: Request) {
    return this.authService.register(dto, clientIp(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto, @Req() req: Request) {
    return this.authService.login(dto, clientIp(req));
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('login/2fa')
  loginTwoFa(@Body() dto: LoginTwoFaDto, @Req() req: Request) {
    return this.authService.loginTwoFa(dto, clientIp(req));
  }

  // @Public() : accepte un access token normal (opt-in) ou un jeton "2FA
  // requise" émis par /auth/login — voir AuthService.resolveSetupOrAccessSubject.
  @Public()
  @Post('2fa/setup')
  setupTwoFa(@Headers('authorization') authorization?: string) {
    return this.authService.setupTwoFa(authorization);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('2fa/enable')
  enableTwoFa(@Headers('authorization') authorization: string | undefined, @Body() dto: EnableTwoFaDto) {
    return this.authService.enableTwoFa(authorization, dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('2fa/disable')
  disableTwoFa(@CurrentUser('id') userId: string) {
    return this.authService.disableTwoFa(userId);
  }

  @Public()
  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout')
  async logout(@Body() dto: RefreshTokenDto): Promise<void> {
    await this.sessionService.revokeSessionByToken(dto.refreshToken);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post('logout-all')
  async logoutAll(@CurrentUser('id') userId: string): Promise<void> {
    await this.sessionService.revokeAllSessions(userId);
  }

  @Get('sessions')
  listSessions(@CurrentUser('id') userId: string) {
    return this.sessionService.listActiveSessions(userId);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete('sessions/:id')
  async revokeSession(@Param('id') id: string, @CurrentUser('id') userId: string): Promise<void> {
    await this.sessionService.revokeSession(id, userId);
  }

  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.usersService.findOneVisibleTo(user, user.id);
  }
}
