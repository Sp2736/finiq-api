import {
  Controller,
  Get,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ResponseFormatter } from 'src/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { HierarchyAccessService } from 'src/common/services/hierarchy-access.service';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  private readonly logger = new Logger(DashboardController.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly hierarchyAccess: HierarchyAccessService,
  ) {}

  @Get('summary')
  @HttpCode(HttpStatus.OK)
  async getSummary(@Request() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    this.logger.debug(
      `Dashboard summary requested for company: ${access.companyId}`,
    );
    const result = await this.dashboardService.getSummary(access);
    return ResponseFormatter.success(result, 'Dashboard summary retrieved');
  }

  @Get('aum-trend')
  @HttpCode(HttpStatus.OK)
  async getAumTrend(@Request() req: any, @Query('months') months?: number) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    const result = await this.dashboardService.getAumTrend(
      access,
      months || 12,
    );
    return ResponseFormatter.success(result, 'AUM trend data retrieved');
  }

  @Get('portfolio-distribution')
  @HttpCode(HttpStatus.OK)
  async getPortfolioDistribution(@Request() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    const result = await this.dashboardService.getPortfolioDistribution(access);
    return ResponseFormatter.success(
      result,
      'Portfolio distribution retrieved',
    );
  }

  @Get('performance')
  @HttpCode(HttpStatus.OK)
  async getPerformance(@Request() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    const result = await this.dashboardService.getPerformance(access);
    return ResponseFormatter.success(result, 'Performance data retrieved');
  }
}
