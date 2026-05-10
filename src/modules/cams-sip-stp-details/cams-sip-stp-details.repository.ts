import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { CamsSipStpDetail } from 'src/entities';

@Injectable()
export class CamsSipStpDetailsRepository extends BaseRepository<CamsSipStpDetail> {
    protected readonly logger = new Logger(CamsSipStpDetailsRepository.name);

    constructor(
        @InjectRepository(CamsSipStpDetail)
        private readonly camsSipStpDetailRepo: Repository<CamsSipStpDetail>,
    ) {
        super(camsSipStpDetailRepo);
    }
}
