import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class BankAccountsService {
  // Utilizing your existing TypeORM DataSource for secure database connections
  constructor(private readonly dataSource: DataSource) {}

  async getBankAccounts(subBrokerId?: string) {
    try {
      let query = '';
      let values: any[] = [];

      if (subBrokerId) {
        query =
          'SELECT * FROM company_bank_accounts WHERE sub_broker_id = $1 ORDER BY is_primary DESC, created_at DESC';
        values = [subBrokerId];
      } else {
        query =
          'SELECT * FROM company_bank_accounts WHERE sub_broker_id IS NULL ORDER BY is_primary DESC, created_at DESC';
      }

      const results = await this.dataSource.query(query, values);
      return { success: true, data: results };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch bank accounts',
      );
    }
  }

  async addBankAccount(payload: any) {
    try {
      const query = `
        INSERT INTO company_bank_accounts 
        (company_id, arn_id, sub_broker_id, bank_name, account_number, account_holder_name, ifsc_code, upi_id, is_primary)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *;
      `;
      const values = [
        payload.company_id,
        payload.arn_id || null,
        payload.sub_broker_id || null,
        payload.bank_name,
        payload.account_number,
        payload.account_holder_name,
        payload.ifsc_code,
        payload.upi_id || null,
        payload.is_primary || false,
      ];

      const result = await this.dataSource.query(query, values);
      return { success: true, data: result[0] };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to add bank account',
      );
    }
  }
}
