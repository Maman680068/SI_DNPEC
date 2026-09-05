import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { OrgModule } from './org/org.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { TasksModule } from './tasks/tasks.module';
import { CommunicationModule } from './communication/communication.module';
import { LeavesModule } from './leaves/leaves.module';
import { DocumentsModule } from './documents/documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    CommonModule,
    OrgModule,
    UsersModule,
    AuthModule,
    TasksModule,
    CommunicationModule,
    LeavesModule,
    DocumentsModule,
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
