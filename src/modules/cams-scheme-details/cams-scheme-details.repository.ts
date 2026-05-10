import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { CamsSchemeDetail } from 'src/entities';

@Injectable()
export class CamsSchemeDetailsRepository extends BaseRepository<CamsSchemeDetail> {
    protected readonly logger = new Logger(CamsSchemeDetailsRepository.name);

    constructor(
        @InjectRepository(CamsSchemeDetail)
        private readonly camsSchemeDetailRepo: Repository<CamsSchemeDetail>,
    ) {
        super(camsSchemeDetailRepo);
    }
}
