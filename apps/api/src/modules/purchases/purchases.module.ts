import { Module } from '@nestjs/common';
import { PurchasesController } from './presentation/purchases.controller';
import { PurchasesService } from './application/purchases.service';
import { PurchaseRepository } from './infrastructure/purchase.repository';

@Module({
  controllers: [PurchasesController],
  providers: [PurchasesService, PurchaseRepository],
  exports: [PurchasesService],
})
export class PurchasesModule {}
