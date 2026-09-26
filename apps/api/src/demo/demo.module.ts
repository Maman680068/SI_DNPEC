import { Module } from '@nestjs/common';
import { DemoExpirationService } from './demo-expiration.service';

@Module({
  providers: [DemoExpirationService],
  exports: [DemoExpirationService],
})
export class DemoModule {}
