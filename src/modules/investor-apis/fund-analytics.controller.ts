import {
  Controller,
  Get,
  UseGuards,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { InvestorApisService } from './investor-apis.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseFormatter } from 'src/common';

@Controller('api/fund-analytics')
@UseGuards(JwtAuthGuard)
export class FundAnalyticsController {
  constructor(private readonly service: InvestorApisService) {}

  @Get('returns/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundReturns(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundReturns(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund returns retrieved successfully',
    );
  }

  @Get('monthly-returns/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundMonthlyReturns(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundMonthlyReturns(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund monthly returns retrieved successfully',
    );
  }

  @Get('composition/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundComposition(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundComposition(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund composition retrieved successfully',
    );
  }

  @Get('stylebox/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundStylebox(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundStylebox(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund stylebox retrieved successfully',
    );
  }

  @Get('risk-stats/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundRiskStats(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundRiskStats(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund risk statistics retrieved successfully',
    );
  }

  @Get('sector-allocation/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundSectorAllocation(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundSectorAllocation(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund sector allocation retrieved successfully',
    );
  }

  // ─── ADDED HOLDINGS ENDPOINT ───
  @Get('holdings/:amfiCode')
  @HttpCode(HttpStatus.OK)
  async getFundHoldings(@Param('amfiCode') amfiCode: string) {
    const result = await this.service.getFundHoldings(amfiCode);
    return ResponseFormatter.success(
      result,
      'Fund holdings retrieved successfully',
    );
  }
}
