import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  // PersonnelModule : UsersService.updateAssignment enregistre un événement
  // de carrière (AFFECTATION) via PersonnelHistoryService — voir
  // schema.prisma, PersonnelCareerEvent. Sens unique (PersonnelModule
  // n'importe jamais UsersModule) pour éviter tout cycle avec AuthModule.
  imports: [OrgModule, PersonnelModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
