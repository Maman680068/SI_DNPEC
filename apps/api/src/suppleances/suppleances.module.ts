import { Module } from '@nestjs/common';
import { OrgModule } from '../org/org.module';
import { CommunicationModule } from '../communication/communication.module';
import { SuppleancesController } from './suppleances.controller';
import { SuppleancesService } from './suppleances.service';

@Module({
  imports: [OrgModule, CommunicationModule],
  controllers: [SuppleancesController],
  providers: [SuppleancesService],
})
export class SuppleancesModule {}
