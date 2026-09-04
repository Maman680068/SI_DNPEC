import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TotpService } from './services/totp.service';
import { SessionService } from './services/session.service';
import { LoginAttemptService } from './services/login-attempt.service';

@Module({
  imports: [UsersModule],
  controllers: [AuthController],
  providers: [AuthService, TotpService, SessionService, LoginAttemptService],
})
export class AuthModule {}
