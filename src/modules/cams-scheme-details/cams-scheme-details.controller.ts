import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CamsSchemeDetailsService } from './cams-scheme-details.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/cams-scheme-details')
export class CamsSchemeDetailsController {
    constructor(private readonly service: CamsSchemeDetailsService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'Scheme Details retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'Scheme Detail retrieved successfully');
    }
}
