import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { CapitalGainsService } from './capital-gains.service';
import { CapitalGainsQueryDto } from './dto/capital-gains.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseFormatter } from 'src/common';

@Controller('api/capital-gains')
@UseGuards(JwtAuthGuard)
export class CapitalGainsController {
    constructor(private readonly capitalGainsService: CapitalGainsService) { }

    @Post()
    @HttpCode(HttpStatus.OK)
    async getCapitalGains(
        @Body() body: CapitalGainsQueryDto,
    ) {
        const result = await this.capitalGainsService.getCapitalGains(
            body.investor_id,
            body.from_date,
            body.to_date,
        );
        return ResponseFormatter.success(result, 'Capital gains retrieved successfully');
    }
}
