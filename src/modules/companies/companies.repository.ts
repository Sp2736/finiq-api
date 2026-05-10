import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BaseRepository } from 'src/common/base/base.repository';
import { Company } from 'src/entities';

@Injectable()
export class CompaniesRepository extends BaseRepository<Company> {
    protected readonly logger = new Logger(CompaniesRepository.name);

    constructor(
        @InjectRepository(Company)
        private readonly companyRepo: Repository<Company>,
    ) {
        super(companyRepo);
    }
}
