import { Module } from '@nestjs/common';
import { SalesController } from './presentation/sales.controller';
import { SalesService } from './application/sales.service';
import { SaleRepository } from './infrastructure/sale.repository';
import { RegistersModule } from '../registers/registers.module';

@Module({
  imports: [RegistersModule],
  controllers: [SalesController],
  providers: [SalesService, SaleRepository],
  exports: [SalesService],
})
export class SalesModule {}
