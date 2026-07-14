import { Module } from '@nestjs/common';
import { PaymentTypesController } from './presentation/payment-types.controller';
import { PaymentTypesService } from './application/payment-types.service';
import { PaymentTypeRepository } from './infrastructure/payment-type.repository';

@Module({
  controllers: [PaymentTypesController],
  providers: [PaymentTypesService, PaymentTypeRepository],
  exports: [PaymentTypesService],
})
export class PaymentTypesModule {}
