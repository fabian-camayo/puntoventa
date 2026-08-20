import { Module } from '@nestjs/common';
import { ProductImportTypesController } from './presentation/product-import-types.controller';
import { ProductImportTypesService } from './application/product-import-types.service';
import { ProductImportTypeRepository } from './infrastructure/product-import-type.repository';
import { ProductsModule } from '../products/products.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ProductsModule, InventoryModule],
  controllers: [ProductImportTypesController],
  providers: [ProductImportTypesService, ProductImportTypeRepository],
  exports: [ProductImportTypesService],
})
export class ProductImportTypesModule {}
