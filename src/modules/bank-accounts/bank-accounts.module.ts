import { Module } from '@nestjs/common';
import { BankAccountsController } from './bank-accounts.controller';
import { BankAccountsService } from './bank-accounts.service';

@Module({
  controllers: [BankAccountsController],
  providers: [BankAccountsService],
  exports: [BankAccountsService], // Exported in case other modules need to fetch bank data
})
export class BankAccountsModule {}