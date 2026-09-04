import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { AuditService } from './audit/audit.service';
import { PasswordService } from './security/password.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
  imports: [
    // Configuré ici (et non dans auth/) pour que JwtAuthGuard, global dès ce
    // scaffold, puisse vérifier les tokens avant même que le module auth
    // (qui les émettra via ce même JwtService) n'existe.
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_ACCESS_EXPIRES_IN', '15m') as `${number}${'s' | 'm' | 'h' | 'd'}`,
        },
      }),
    }),
  ],
  providers: [AuditService, PasswordService, JwtAuthGuard, RolesGuard],
  exports: [AuditService, PasswordService, JwtModule, JwtAuthGuard, RolesGuard],
})
export class CommonModule {}
