import { Module } from '@nestjs/common';
import { RegistersController } from './presentation/registers.controller';
import { RegistersService } from './application/registers.service';
import { RegisterAccessService } from './application/register-access.service';
import { RegisterRepository } from './infrastructure/register.repository';

@Module({
  controllers: [RegistersController],
  providers: [RegistersService, RegisterAccessService, RegisterRepository],
  exports: [RegistersService, RegisterAccessService],
})
export class RegistersModule {}
