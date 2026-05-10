import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CamsInvestorStaticDetailsService } from './cams-investor-static-details.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/cams-investor-static-details')
export class CamsInvestorStaticDetailsController {
    constructor(private readonly service: CamsInvestorStaticDetailsService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'Details retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'Detail retrieved successfully');
    }
}
