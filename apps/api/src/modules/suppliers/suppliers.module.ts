import { Module } from '@nestjs/common';
import { SuppliersController } from './presentation/suppliers.controller';
import { SuppliersService } from './application/suppliers.service';
import { SupplierRepository } from './infrastructure/supplier.repository';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierRepository],
  exports: [SuppliersService],
})
export class SuppliersModule {}
