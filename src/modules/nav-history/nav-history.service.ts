import { Injectable, Logger } from '@nestjs/common';
import { BaseService } from 'src/common/base/base.service';
import { NavHistory } from 'src/entities';
import { NavHistoryRepository } from './nav-history.repository';
import { PaginationHelper } from 'src/common';
import moment from 'moment';
import { firstValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

@Injectable()
export class NavHistoryService extends BaseService<NavHistory, any, any> {
    protected readonly logger = new Logger(NavHistoryService.name);

    constructor(
        private readonly repository: NavHistoryRepository,
        private readonly httpService: HttpService,
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

    /**
     * Fallback method to sync NAV for a specific date range
     */
    async syncDateRange(fromDate: string, toDate: string) {
        const start = moment(fromDate, 'YYYY-MM-DD');
        const end = moment(toDate, 'YYYY-MM-DD');
        let current = moment(start);

        while (current <= end) {
            const dateStr = current.format('DD-MMM-YYYY');
            const url = `https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx?tp=1&frmdt=${dateStr}&todt=${dateStr}`;
            // const url = 'https://www.amfiindia.com/uploads/NAV_All_31_Jan2018_cf117d62c0.txt';

            this.logger.log(`[Manual Sync] Fetching NAV for: ${dateStr}`);

            try {
                const response = await firstValueFrom(this.httpService.get(url));
                if (response.data && response.data.length > 100) {
                    await this.processAndUpsert(response.data);
                }
            } catch (error) {
                this.logger.error(`Failed to sync ${dateStr}: ${error.message}`);
            }

            current.add(1, 'days');
            if (current <= end) await new Promise(res => setTimeout(res, 1000));
        }
        return { message: 'Sync process completed' };
    }

    private async processAndUpsert(data: string) {
        const lines = data.split('\n');
        const batch: any[] = [];
        let currentCategory: string | null = null;

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            // Detect category header (e.g., "Open Ended Schemes ( Equity Scheme - Mid Cap Fund )")
            // We only look for headers in lines that DO NOT have semicolons to avoid misinterpreting scheme names.
            if (!trimmedLine.includes(';') && trimmedLine.includes('(') && trimmedLine.includes(')')) {
                const match = trimmedLine.match(/\(([^)]+)\)/);
                if (match && match[1]) {
                    currentCategory = match[1].trim();
                }
                continue;
            }

            // Skip non-data rows or column headers
            if (!trimmedLine.includes(';') || trimmedLine.includes('Scheme Code')) continue;

            const parts = trimmedLine.split(';');
            const navValue = parseFloat(parts[4]);
            const dateStr = parts[parts.length - 1]?.trim();
            const momentDate = moment(dateStr, 'DD-MMM-YYYY');

            if (isNaN(navValue) || !momentDate.isValid()) continue;

            batch.push({
                schemeCode: parseInt(parts[0]),
                schemeName: parts[1].trim(),
                isinPayoutGrowth: parts[2] === '-' ? null : parts[2],
                isinReinvestment: parts[3] === '-' ? null : parts[3],
                nav: navValue,
                navDate: momentDate.toDate(),
                category: currentCategory,
            });
        }

        if (batch.length > 0) {
            // Using your repository's query builder
            await this.repository.upsertBatch(batch);
            this.logger.log(`Upserted ${batch.length} records.`);
        }
    }
}
