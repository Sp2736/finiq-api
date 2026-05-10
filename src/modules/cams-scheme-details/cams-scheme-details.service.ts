import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from 'src/common/base/base.service';
import { CamsSchemeDetail } from 'src/entities';
import { CamsSchemeDetailsRepository } from './cams-scheme-details.repository';
import { PaginationHelper } from 'src/common';

@Injectable()
export class CamsSchemeDetailsService extends BaseService<CamsSchemeDetail, any, any> {
    protected readonly logger = new Logger(CamsSchemeDetailsService.name);

    constructor(
        private readonly repository: CamsSchemeDetailsRepository,
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
