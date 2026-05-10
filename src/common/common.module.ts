import { Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { TransactionService } from './services/transaction.service';
import { HealthService } from './services/health.service';

/**
 * Common module for shared utilities, filters, exceptions, interceptors
 */
@Module({
  providers: [CacheService, TransactionService, HealthService],
  exports: [CacheService, TransactionService, HealthService],
})
export class CommonModule {}
