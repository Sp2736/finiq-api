import { Injectable, Logger } from '@nestjs/common';
import { DataSource, Repository, EntityManager } from 'typeorm';

/**
 * Transaction manager for database transactions
 * Ensures data consistency across multiple operations
 */
@Injectable()
export class TransactionService {
  private logger = new Logger(TransactionService.name);

  constructor(private dataSource: DataSource) {}

  /**
   * Execute operations within a transaction
   */
  async execute<T>(
    callback: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const result = await callback(queryRunner.manager);
      await queryRunner.commitTransaction();
      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Transaction failed: ${error.message}`, error.stack);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute multiple operations in a transaction
   */
  async executeBatch<T>(
    callback: (manager: EntityManager) => Promise<T[]>,
  ): Promise<T[]> {
    return this.execute(callback);
  }
}
