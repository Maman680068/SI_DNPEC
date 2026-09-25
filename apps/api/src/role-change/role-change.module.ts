import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { PersonnelModule } from '../personnel/personnel.module';
import { CommunicationModule } from '../communication/communication.module';
import { AuthModule } from '../auth/auth.module';
import { StagesModule } from '../stages/stages.module';
import { RoleChangeController } from './role-change.controller';
import { RoleChangeService } from './role-change.service';

@Module({
  imports: [UsersModule, PersonnelModule, CommunicationModule, AuthModule, StagesModule],
  controllers: [RoleChangeController],
  providers: [RoleChangeService],
})
export class RoleChangeModule {}
