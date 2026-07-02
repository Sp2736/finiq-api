import { Injectable, Logger } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';
import { HierarchyAccessContext } from 'src/common/services/hierarchy-access.service';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(private readonly repository: DashboardRepository) {}

  /**
   * Get dashboard summary based on hierarchy access
   */
  async getSummary(access: HierarchyAccessContext) {
    this.logger.debug(`Getting summary for company: ${access.companyId}`);

    const [aumData, investorCount] = await Promise.all([
      this.repository.getAUM(access),
      this.repository.getInvestorCount(access),
    ]);

    return {
      total_aum: parseFloat(aumData.totalAum.toFixed(2)),
      total_invested: parseFloat(aumData.totalInvested.toFixed(2)),
      one_day_change: parseFloat(aumData.oneDayChange.toFixed(2)),
      one_day_change_pct:
        aumData.totalAum > 0
          ? parseFloat(
              ((aumData.oneDayChange / aumData.totalAum) * 100).toFixed(2),
            )
          : 0,
      current_portfolio_value: parseFloat(aumData.totalAum.toFixed(2)),
      total_investors: investorCount,
      unrealised_gains: parseFloat(
        (aumData.totalAum - aumData.totalInvested).toFixed(2),
      ),
      unrealised_gains_pct:
        aumData.totalInvested > 0
          ? parseFloat(
              (
                ((aumData.totalAum - aumData.totalInvested) /
                  aumData.totalInvested) *
                100
              ).toFixed(2),
            )
          : 0,

      // Aliases for broker compatibility
      total_managed_aum: parseFloat(aumData.totalAum.toFixed(2)),
      total_clients: investorCount,
      portfolio_value: parseFloat(aumData.totalAum.toFixed(2)),
      daily_change: parseFloat(aumData.oneDayChange.toFixed(2)),
      daily_change_pct:
        aumData.totalAum > 0
          ? parseFloat(
              ((aumData.oneDayChange / aumData.totalAum) * 100).toFixed(2),
            )
          : 0,
    };
  }

  /**
   * Get AUM trend for charts based on hierarchy access
   */
  async getAumTrend(access: HierarchyAccessContext, months: number = 12) {
    this.logger.debug(`Getting AUM trend for company: ${access.companyId}`);
    return this.repository.getAumTrend(access, months);
  }

  /**
   * Get portfolio distribution for pie/donut charts based on hierarchy access
   */
  async getPortfolioDistribution(access: HierarchyAccessContext) {
    this.logger.debug(
      `Getting portfolio distribution for company: ${access.companyId}`,
    );
    return this.repository.getPortfolioDistribution(access);
  }

  /**
   * Get performance metrics based on hierarchy access
   */
  async getPerformance(access: HierarchyAccessContext) {
    this.logger.debug(`Getting performance for company: ${access.companyId}`);
    return this.repository.getPerformance(access);
  }
}
