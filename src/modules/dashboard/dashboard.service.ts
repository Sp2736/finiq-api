import { Injectable, Logger } from '@nestjs/common';
import { DashboardRepository } from './dashboard.repository';

@Injectable()
export class DashboardService {
    private readonly logger = new Logger(DashboardService.name);

    constructor(private readonly repository: DashboardRepository) { }

    /**
     * Get admin dashboard summary
     */
    async getAdminSummary(companyId: string) {
        this.logger.debug(`Getting admin summary for company: ${companyId}`);

        const [aumData, investorCount] = await Promise.all([
            this.repository.getCompanyAUM(companyId),
            this.repository.getInvestorCount(companyId),
        ]);

        return {
            total_aum: parseFloat(aumData.totalAum.toFixed(2)),
            total_invested: parseFloat(aumData.totalInvested.toFixed(2)),
            one_day_change: parseFloat(aumData.oneDayChange.toFixed(2)),
            one_day_change_pct: aumData.totalAum > 0
                ? parseFloat(((aumData.oneDayChange / aumData.totalAum) * 100).toFixed(2))
                : 0,
            current_portfolio_value: parseFloat(aumData.totalAum.toFixed(2)),
            total_investors: investorCount,
            unrealised_gains: parseFloat((aumData.totalAum - aumData.totalInvested).toFixed(2)),
            unrealised_gains_pct: aumData.totalInvested > 0
                ? parseFloat((((aumData.totalAum - aumData.totalInvested) / aumData.totalInvested) * 100).toFixed(2))
                : 0,
        };
    }

    /**
     * Get AUM trend for charts
     */
    async getAumTrend(companyId: string, months: number = 12) {
        this.logger.debug(`Getting AUM trend for company: ${companyId}`);
        return this.repository.getAumTrend(companyId, months);
    }

    /**
     * Get portfolio distribution for pie/donut charts
     */
    async getPortfolioDistribution(companyId: string) {
        this.logger.debug(`Getting portfolio distribution for company: ${companyId}`);
        return this.repository.getPortfolioDistribution(companyId);
    }

    /**
     * Get broker dashboard summary
     */
    async getBrokerSummary(userProfileId: string, companyId: string) {
        this.logger.debug(`Getting broker summary for profile: ${userProfileId}`);
        const stats = await this.repository.getBrokerClientStats(userProfileId, companyId);

        return {
            total_managed_aum: parseFloat(stats.managedAum.toFixed(2)),
            total_clients: stats.totalClients,
            portfolio_value: parseFloat(stats.portfolioValue.toFixed(2)),
            daily_change: parseFloat(stats.dailyChange.toFixed(2)),
            daily_change_pct: stats.portfolioValue > 0
                ? parseFloat(((stats.dailyChange / stats.portfolioValue) * 100).toFixed(2))
                : 0,
        };
    }

    /**
     * Get broker client statistics
     */
    async getBrokerClientStats(userProfileId: string, companyId: string) {
        this.logger.debug(`Getting broker client stats for profile: ${userProfileId}`);
        return this.repository.getBrokerClientStats(userProfileId, companyId);
    }

    /**
     * Get broker performance metrics
     */
    async getBrokerPerformance(userProfileId: string, companyId: string) {
        this.logger.debug(`Getting broker performance for profile: ${userProfileId}`);
        return this.repository.getBrokerPerformance(userProfileId, companyId);
    }
}
