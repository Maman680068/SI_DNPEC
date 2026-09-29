import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { CommunicationModule } from '../communication/communication.module';
import { AuthController } from './auth.controller';
import { AdminPasswordController } from './admin-password.controller';
import { ReauthController } from './reauth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './services/totp.service';
import { SessionService } from './services/session.service';
import { LoginAttemptService } from './services/login-attempt.service';
import { PasswordResetService } from './services/password-reset.service';

@Module({
  imports: [UsersModule, CommunicationModule],
  controllers: [AuthController, AdminPasswordController, ReauthController],
  providers: [AuthService, TotpService, SessionService, LoginAttemptService, PasswordResetService],
  // SessionService exporté pour RoleChangeModule (révocation des sessions).
  exports: [SessionService],
})
export class AuthModule {}
