import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
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
import { MeetingsModule } from './meetings/meetings.module';
import { ExportModule } from './export/export.module';
import { SuggestionsModule } from './suggestions/suggestions.module';
import { AppController } from './app.controller';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Nécessaire au rappel planifié des réunions (MeetingsService.sendDueReminders,
    // @Cron) — premier usage d'un job planifié dans le projet.
    ScheduleModule.forRoot(),
    PrismaModule,
    CommonModule,
    OrgModule,
    UsersModule,
    AuthModule,
    TasksModule,
    CommunicationModule,
    LeavesModule,
    DocumentsModule,
    MeetingsModule,
    ExportModule,
    SuggestionsModule,
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
