import { Module } from '@nestjs/common';
import { RegistersController } from './presentation/registers.controller';
import { RegistersService } from './application/registers.service';
import { RegisterRepository } from './infrastructure/register.repository';

@Module({
  controllers: [RegistersController],
  providers: [RegistersService, RegisterRepository],
  exports: [RegistersService],
})
export class RegistersModule {}
