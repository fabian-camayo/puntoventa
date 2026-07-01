import { Module } from '@nestjs/common';
import { CustomersController } from './presentation/customers.controller';
import { CustomersService } from './application/customers.service';
import { CustomerRepository } from './infrastructure/customer.repository';

@Module({
  controllers: [CustomersController],
  providers: [CustomersService, CustomerRepository],
  exports: [CustomersService],
})
export class CustomersModule {}
