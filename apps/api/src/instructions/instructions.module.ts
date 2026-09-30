import { Module } from '@nestjs/common';
import { CommunicationModule } from '../communication/communication.module';
import { InstructionsController } from './instructions.controller';
import { InstructionsService } from './instructions.service';

/** Instructions de la Direction (socle N5). */
@Module({
  imports: [CommunicationModule],
  controllers: [InstructionsController],
  providers: [InstructionsService],
  exports: [InstructionsService],
})
export class InstructionsModule {}
