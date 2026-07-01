import { Module } from '@nestjs/common';
import { CategoriesController } from './presentation/categories.controller';
import { CategoriesService } from './application/categories.service';
import { CategoryRepository } from './infrastructure/category.repository';

@Module({
  controllers: [CategoriesController],
  providers: [CategoriesService, CategoryRepository],
  exports: [CategoriesService],
})
export class CategoriesModule {}
