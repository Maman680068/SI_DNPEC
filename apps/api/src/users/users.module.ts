import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [OrgModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
