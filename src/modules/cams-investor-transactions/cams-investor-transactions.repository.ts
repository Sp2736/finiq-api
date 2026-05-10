import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { CamsInvestorTransaction } from 'src/entities';

@Injectable()
export class CamsInvestorTransactionsRepository extends BaseRepository<CamsInvestorTransaction> {
    protected readonly logger = new Logger(CamsInvestorTransactionsRepository.name);

    constructor(
        @InjectRepository(CamsInvestorTransaction)
        private readonly camsInvestorTransactionRepo: Repository<CamsInvestorTransaction>,
    ) {
        super(camsInvestorTransactionRepo);
    }
}
