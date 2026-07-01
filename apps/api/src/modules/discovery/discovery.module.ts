import { Module } from '@nestjs/common';
import { DiscoveryController } from './presentation/discovery.controller';
import { DiscoveryService } from './application/discovery.service';

@Module({
  controllers: [DiscoveryController],
  providers: [DiscoveryService],
  exports: [DiscoveryService],
})
export class DiscoveryModule {}
