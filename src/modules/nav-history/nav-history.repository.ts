import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { NavHistory } from 'src/entities';

@Injectable()
export class NavHistoryRepository extends BaseRepository<NavHistory> {
    protected readonly logger = new Logger(NavHistoryRepository.name);

    constructor(
        @InjectRepository(NavHistory)
        private readonly navHistoryRepo: Repository<NavHistory>,
    ) {
        super(navHistoryRepo);
    }

    /**
     * Batch upsert for NAV records
     */
    async upsertBatch(data: any[]) {
        try {
            return await this.navHistoryRepo
                .createQueryBuilder()
                .insert()
                .values(data)
                // Use the DB column names here
                .orUpdate(['nav', 'scheme_name', 'category'], ['scheme_code', 'nav_date'])
                .execute();
        } catch (error) {
            this.logger.error(`Batch upsert failed: ${error.message}`);
            throw error;
        }
    }
}
