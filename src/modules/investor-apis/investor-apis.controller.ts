import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Request,
  UnauthorizedException,
  HttpCode,
  HttpStatus,
  Param,
} from '@nestjs/common';
import { InvestorApisService } from './investor-apis.service';
import { InvestorsHoldingsService } from '../investors/investors-holdings.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseFormatter } from 'src/common';

@Controller('api/my-portfolio')
@UseGuards(JwtAuthGuard)
export class InvestorApisController {
  constructor(
    private readonly service: InvestorApisService,
    private readonly holdingsService: InvestorsHoldingsService,
  ) {}

  @Get('kpi')
  @HttpCode(HttpStatus.OK)
  async getKpis(@Request() req) {
    if (!req.user || req.user.type !== 'investor') {
      throw new UnauthorizedException(
        'Only authenticated investors can access this endpoint',
      );
    }

    const investorId = req.user.id;
    const holdingsReport =
      await this.holdingsService.getHoldingsReport(investorId);

    const result = {
      invested_amount: holdingsReport.invested_capital || 0,
      current_value: holdingsReport.current_value || 0,
      one_day_change_amount: holdingsReport.todays_pnl || 0,
      one_day_change_percent: holdingsReport.todays_pnl_percent || 0,
      unrealised_gain:
        (holdingsReport.unrealised_gains_st || 0) +
        (holdingsReport.unrealised_gains_lt || 0),
      abs_return_percent: holdingsReport.abs_percent || 0,
      xirr_percent: holdingsReport.xirr_percent || 0,
    };

    return ResponseFormatter.success(
      result,
      'Portfolio KPIs retrieved successfully',
    );
  }

  @Get('portfolio-graph')
  @HttpCode(HttpStatus.OK)
  async getPortfolioGraph(@Request() req) {
    if (!req.user || req.user.type !== 'investor') {
      throw new UnauthorizedException(
        'Only authenticated investors can access this endpoint',
      );
    }

    const investorId = req.user.id;
    const result = await this.holdingsService.getPortfolioGraph(investorId);

    return ResponseFormatter.success(
      result,
      'Portfolio graph data retrieved successfully',
    );
  }

  @Get('portfolio-summary')
  @HttpCode(HttpStatus.OK)
  async getPortfolioSummary(@Request() req) {
    // Ensure it's an investor
    if (req.user.type !== 'investor') {
      throw new UnauthorizedException(
        'Only investors can access this endpoint',
      );
    }

    const investorId = req.user.id;
    const result = await this.service.getPortfolioSummary(investorId);
    return ResponseFormatter.success(
      result,
      'Portfolio summary retrieved successfully',
    );
  }

  @Post('systematic-report')
  @HttpCode(HttpStatus.OK)
  async getSystematicReport(@Request() req, @Body() body: any) {
    if (!req.user || req.user.type !== 'investor') {
      throw new UnauthorizedException(
        'Only authenticated investors can access this endpoint',
      );
    }

    const investorId = req.user.id;
    const { type, status, registrar } = body;

    const result = await this.service.getInvestorSystematicReports(
      investorId,
      type,
      status,
      registrar,
    );

    return ResponseFormatter.success(
      result,
      'Investor systematic report retrieved successfully',
    );
  }
}
