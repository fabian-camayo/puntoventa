import { Module } from '@nestjs/common';
import { ProductsController } from './presentation/products.controller';
import { ProductsService } from './application/products.service';
import { ProductRepository } from './infrastructure/product.repository';

@Module({
  controllers: [ProductsController],
  providers: [ProductsService, ProductRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
