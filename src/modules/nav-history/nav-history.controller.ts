import { Controller, Get, Post, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { NavHistoryService } from './nav-history.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/nav-history')
export class NavHistoryController {
    constructor(private readonly service: NavHistoryService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'NAV History retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'NAV History details retrieved successfully');
    }

    @Post('sync-range')
    async syncRange(
        @Query('from') from: string, // Expected format: YYYY-MM-DD
        @Query('to') to: string      // Expected format: YYYY-MM-DD
    ) {
        await this.service.syncDateRange(from, to);
        return ResponseFormatter.success(null, `NAV sync initiated for the period ${from} to ${to}. Check server logs for detailed progress.`);
    }
}
