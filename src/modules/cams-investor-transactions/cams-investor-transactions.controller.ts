import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CamsInvestorTransactionsService } from './cams-investor-transactions.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/cams-investor-transactions')
export class CamsInvestorTransactionsController {
    constructor(private readonly service: CamsInvestorTransactionsService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'Transactions retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'Transaction retrieved successfully');
    }
}
