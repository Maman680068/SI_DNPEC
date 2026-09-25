import { Module } from '@nestjs/common';
import { LogistiqueModule } from '../logistique/logistique.module';
import { AideController } from './aide.controller';
import { AideService } from './aide.service';

@Module({
  imports: [LogistiqueModule],
  controllers: [AideController],
  providers: [AideService],
})
export class AideModule {}
