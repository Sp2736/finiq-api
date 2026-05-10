import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamsInvestorTransaction } from 'src/entities';
import { CamsInvestorTransactionsController } from './cams-investor-transactions.controller';
import { CamsInvestorTransactionsService } from './cams-investor-transactions.service';
import { CamsInvestorTransactionsRepository } from './cams-investor-transactions.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CamsInvestorTransaction])],
    controllers: [CamsInvestorTransactionsController],
    providers: [CamsInvestorTransactionsService, CamsInvestorTransactionsRepository],
    exports: [CamsInvestorTransactionsService],
})
export class CamsInvestorTransactionsModule { }
