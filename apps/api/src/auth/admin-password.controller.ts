import { Body, Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { SystemRole } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthenticatedUser } from '../common/types/auth-user.type';
import { AuthService } from './auth.service';
import { AdminSetPasswordDto } from './dto/admin-set-password.dto';

/**
 * Réinitialisation de mot de passe déclenchée par un administrateur, depuis
 * la fiche d'un compte (RF-SEC) — routes sous /users pour rester à côté des
 * autres actions de gestion de compte (PATCH /users/:id/status,
 * /:id/assignment), mais implémentées ici : la logique (jeton de
 * réinitialisation, envoi d'email, révocation de sessions) appartient déjà
 * à AuthService/PasswordResetService/SessionService (module auth/), et
 * UsersModule ne peut pas importer AuthModule sans créer un cycle
 * (AuthModule importe déjà UsersModule).
 */
@Controller('users')
export class AdminPasswordController {
  constructor(private readonly authService: AuthService) {}

  @Roles(SystemRole.ADMIN_SYSTEME)
  @HttpCode(HttpStatus.OK)
  @Post(':userId/password/send-reset-email')
  sendResetEmail(@Param('userId') userId: string, @CurrentUser() actor: AuthenticatedUser) {
    return this.authService.adminSendResetEmail(actor, userId);
  }

  @Roles(SystemRole.ADMIN_SYSTEME)
  @HttpCode(HttpStatus.OK)
  @Post(':userId/password/set')
  setPassword(
    @Param('userId') userId: string,
    @Body() dto: AdminSetPasswordDto,
    @CurrentUser() actor: AuthenticatedUser,
  ) {
    return this.authService.adminSetPassword(actor, userId, dto);
  }
}
