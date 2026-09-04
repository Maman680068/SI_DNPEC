import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OrgModule } from './org/org.module';
import { UsersModule } from './users/users.module';

// Modules "métier" à venir (hors périmètre de ce scaffold) : tasks,
// communication, documents, leaves, notifications, audit-reporting.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    OrgModule,
    UsersModule,
  ],
  providers: [
    // Guards globaux, exécutés dans cet ordre : JwtAuthGuard peuple
    // request.user, puis RolesGuard peut s'appuyer dessus. Un handler non
    // marqué @Public() est donc authentifié par défaut.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
