import { Module } from '@nestjs/common';
import { CacheService } from './services/cache.service';
import { TransactionService } from './services/transaction.service';
import { HealthService } from './services/health.service';
import { HierarchyAccessService } from './services/hierarchy-access.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubBroker } from 'src/entities/sub-broker.entity';

/**
 * Common module for shared utilities, filters, exceptions, interceptors
 */
@Module({
  imports: [TypeOrmModule.forFeature([SubBroker])],
  providers: [
    CacheService,
    TransactionService,
    HealthService,
    HierarchyAccessService,
  ],
  exports: [
    CacheService,
    TransactionService,
    HealthService,
    HierarchyAccessService,
  ],
})
export class CommonModule {}
