import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from 'src/common/base/base.service';
import { CamsInvestorStaticDetail } from 'src/entities';
import { CamsInvestorStaticDetailsRepository } from './cams-investor-static-details.repository';
import { PaginationHelper } from 'src/common';

@Injectable()
export class CamsInvestorStaticDetailsService extends BaseService<CamsInvestorStaticDetail, any, any> {
    protected readonly logger = new Logger(CamsInvestorStaticDetailsService.name);

    constructor(
        private readonly repository: CamsInvestorStaticDetailsRepository,
    ) {
        super();
    }

    async findAll(page: number = 1, limit: number = 10) {
        try {
            const pagination = PaginationHelper.getPaginationParams(page, limit);
            const [data, total] = await this.repository.findAll(pagination);
            return this.formatPaginatedResponse(data, total, pagination);
        } catch (error) {
            await this.handleError(error, 'findAll');
        }
    }

    async findById(id: string) {
        try {
            return await this.repository.findById(id);
        } catch (error) {
            await this.handleError(error, 'findById');
        }
    }
}
