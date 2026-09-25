import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { CommonModule } from './common/common.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { StagiaireGuard } from './common/guards/stagiaire.guard';
import { RequestContextMiddleware } from './common/request-context/request-context.middleware';
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
import { PersonnelModule } from './personnel/personnel.module';
import { PersonnelImportModule } from './personnel/personnel-import.module';
import { StagesModule } from './stages/stages.module';
import { SuppleancesModule } from './suppleances/suppleances.module';
import { CourrierModule } from './courrier/courrier.module';
import { RoleChangeModule } from './role-change/role-change.module';
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
    PersonnelModule,
    PersonnelImportModule,
    StagesModule,
    SuppleancesModule,
    CourrierModule,
    RoleChangeModule,
  ],
  providers: [
    // Guards globaux, exécutés dans cet ordre : JwtAuthGuard peuple
    // request.user, puis RolesGuard peut s'appuyer dessus, puis StagiaireGuard
    // (liste blanche du rôle STAGIAIRE). Un handler non
    // marqué @Public() est donc authentifié par défaut.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: StagiaireGuard },
  ],
})
export class AppModule implements NestModule {
  // RequestContextMiddleware avant tout (middleware s'exécute avant les
  // Guards) : établit le store AsyncLocalStorage que JwtAuthGuard remplit
  // ensuite (suppléance/intérim, §4.10) et qu'AuditService lit à la volée.
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
