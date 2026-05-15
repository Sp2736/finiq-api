import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { BrokerTransaction } from '../../entities/broker-transaction.entity';

@Injectable()
export class BrokerTransactionsService {
  constructor(
    @InjectRepository(BrokerTransaction)
    private readonly transactionRepo: Repository<BrokerTransaction>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * API 1: Get list of brokers with their Net Balance, Credits, and Debits
   */
  async getLedgerSummary(companyId: string) {
    const query = `
        SELECT 
            sb.id as sub_broker_id,
            sb.name as sub_broker_name,
            sb.arn_id,
            COALESCE(SUM(CASE WHEN bt.type = 'CREDIT' THEN bt.amount ELSE 0 END), 0) as total_credits,
            COALESCE(SUM(CASE WHEN bt.type = 'DEBIT' THEN bt.amount ELSE 0 END), 0) as total_debits,
            COALESCE(SUM(CASE WHEN bt.type = 'CREDIT' THEN bt.amount ELSE -bt.amount END), 0) as net_balance
        FROM sub_brokers sb
        LEFT JOIN broker_transactions bt ON bt.sub_broker_id = sb.id
        WHERE sb.company_id = $1 OR sb.company_id IS NULL
        GROUP BY sb.id, sb.name, sb.arn_id
        ORDER BY sb.name ASC
    `;

    const summary = await this.dataSource.query(query, [companyId]);
    return { data: summary };
  }

  /**
   * API 2: Get detailed history for the expanded dropdown
   */
  async getTransactionHistory(subBrokerId: string) {
    const transactions = await this.transactionRepo.find({
      where: { sub_broker_id: subBrokerId },
      order: { transaction_date: 'DESC', created_at: 'DESC' },
    });

    return { data: transactions };
  }
}