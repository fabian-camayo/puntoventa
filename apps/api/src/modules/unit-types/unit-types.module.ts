import { Module } from '@nestjs/common';
import { UnitTypesController } from './presentation/unit-types.controller';
import { UnitTypesService } from './application/unit-types.service';
import { UnitTypeRepository } from './infrastructure/unit-type.repository';

@Module({
  controllers: [UnitTypesController],
  providers: [UnitTypesService, UnitTypeRepository],
  exports: [UnitTypesService],
})
export class UnitTypesModule {}
