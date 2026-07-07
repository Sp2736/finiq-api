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

    async findCompanyDetail(companyId: string) {
        const company = await this.companyRepo.findOne({
            where: { id: companyId },
            relations: ['details'],
        });
        return company?.details;
    }

    async updateCompanyDetailLogoKey(companyId: string, key: string | null) {
        // Find detail first to get its ID, or update via company_id
        const detail = await this.findCompanyDetail(companyId);
        if (detail) {
            detail.logo_s3_key = key;
            await this.companyRepo.manager.save(detail);
        }
    }
}
