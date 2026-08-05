import { Module } from '@nestjs/common';
import { BankAccountsController } from './presentation/bank-accounts.controller';
import { BankAccountsService } from './application/bank-accounts.service';
import { BankAccountRepository } from './infrastructure/bank-account.repository';

@Module({
  controllers: [BankAccountsController],
  providers: [BankAccountsService, BankAccountRepository],
  exports: [BankAccountsService],
})
export class BankAccountsModule {}
