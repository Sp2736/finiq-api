import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { CamsInvestorStaticDetail } from 'src/entities';

@Injectable()
export class CamsInvestorStaticDetailsRepository extends BaseRepository<CamsInvestorStaticDetail> {
    protected readonly logger = new Logger(CamsInvestorStaticDetailsRepository.name);

    constructor(
        @InjectRepository(CamsInvestorStaticDetail)
        private readonly camsInvestorStaticDetailRepo: Repository<CamsInvestorStaticDetail>,
    ) {
        super(camsInvestorStaticDetailRepo);
    }
}
