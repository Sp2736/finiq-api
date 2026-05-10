import { Controller, Get, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { CamsSipStpDetailsService } from './cams-sip-stp-details.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/cams-sip-stp-details')
export class CamsSipStpDetailsController {
    constructor(private readonly service: CamsSipStpDetailsService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'SIP/STP Details retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'SIP/STP Detail retrieved successfully');
    }
}
