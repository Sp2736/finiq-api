import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrokerTransaction } from '../../entities/broker-transaction.entity';
import { BrokerTransactionsService } from './broker-transactions.service';
import { BrokerTransactionsController } from './broker-transactions.controller';

@Module({
  imports: [TypeOrmModule.forFeature([BrokerTransaction])],
  providers: [BrokerTransactionsService],
  controllers: [BrokerTransactionsController],
  exports: [BrokerTransactionsService],
})
export class BrokerTransactionsModule {}