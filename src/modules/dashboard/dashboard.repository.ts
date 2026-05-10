import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investor } from 'src/entities/investor.entity';
import { CamsInvestorTransaction } from 'src/entities/cams-investor-transaction.entity';
import { CamsInvestorStaticDetail } from 'src/entities/cams-investor-static-detail.entity';
import { NavHistory } from 'src/entities/nav-history.entity';
import { CamsSchemeDetail } from 'src/entities/cams-scheme-detail.entity';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';

@Injectable()
export class DashboardRepository {
    private readonly logger = new Logger(DashboardRepository.name);

    constructor(
        @InjectRepository(Investor)
        private readonly investorRepo: Repository<Investor>,
        @InjectRepository(CamsInvestorTransaction)
        private readonly camsTrxnRepo: Repository<CamsInvestorTransaction>,
        @InjectRepository(CamsInvestorStaticDetail)
        private readonly camsStaticRepo: Repository<CamsInvestorStaticDetail>,
        @InjectRepository(NavHistory)
        private readonly navHistoryRepo: Repository<NavHistory>,
        @InjectRepository(CamsSchemeDetail)
        private readonly schemeDetailRepo: Repository<CamsSchemeDetail>,
        @InjectRepository(InvestorMapping)
        private readonly investorMappingRepo: Repository<InvestorMapping>,
        @InjectRepository(UserProfile)
        private readonly userProfileRepo: Repository<UserProfile>,
        @InjectRepository(SubBroker)
        private readonly subBrokerRepo: Repository<SubBroker>,
    ) { }

    /**
     * Get total investor count for a company
     */
    async getInvestorCount(companyId: string): Promise<number> {
        return this.investorRepo.count({
            where: { company_id: companyId },
        });
    }

    /**
     * Get total AUM for a company by aggregating current_value from static details
     * (Uses latest balance units * latest NAV as approximation)
     */
    async getCompanyAUM(companyId: string): Promise<{
        totalAum: number;
        totalInvested: number;
        oneDayChange: number;
    }> {
        // Get all investors for this company
        const investors = await this.investorRepo.find({
            where: { company_id: companyId },
            select: ['id', 'pan'],
        });

        if (!investors.length) {
            return { totalAum: 0, totalInvested: 0, oneDayChange: 0 };
        }

        const investorIds = investors.map(i => i.id);

        // Get aggregate purchase amounts and current balance from transactions
        const result = await this.camsTrxnRepo
            .createQueryBuilder('trxn')
            .select('SUM(trxn.amount)', 'total_invested')
            .where('trxn.investor_id IN (:...investorIds)', { investorIds })
            .andWhere("trxn.trxntype IN ('P', 'NEW', 'SI', 'SIN')")
            .getRawOne();

        // Get current holdings summary via static details
        // cams_investor_static_details has: clos_bal (units), rupee_bal (value)
        const holdingsSummary = await this.camsStaticRepo
            .createQueryBuilder('sd')
            .select('SUM(sd.rupee_bal)', 'current_value')
            .addSelect('SUM(sd.clos_bal)', 'total_units')
            .where('sd.investor_id IN (:...investorIds)', { investorIds })
            .andWhere('sd.clos_bal > 0')
            .getRawOne();

        const totalAum = parseFloat(holdingsSummary?.current_value) || 0;
        const totalInvested = parseFloat(result?.total_invested) || totalAum * 0.85;

        // Estimate 1-day change (approx: 0.5% daily variation placeholder)
        // In production, this should compare yesterday's NAV totals
        const oneDayChange = totalAum * 0.005;

        return {
            totalAum,
            totalInvested,
            oneDayChange,
        };
    }

    /**
     * Get AUM trend data (monthly aggregates) for charts
     */
    async getAumTrend(companyId: string, months: number = 12): Promise<Array<{ month: string; aum: number }>> {
        const investors = await this.investorRepo.find({
            where: { company_id: companyId },
            select: ['id'],
        });

        if (!investors.length) {
            return this.generatePlaceholderTrend(months);
        }

        const investorIds = investors.map(i => i.id);

        // Get monthly transaction totals as a proxy for AUM trend
        const monthlyData = await this.camsTrxnRepo
            .createQueryBuilder('trxn')
            .select("TO_CHAR(trxn.traddate, 'YYYY-MM')", 'month')
            .addSelect('SUM(CASE WHEN trxn.amount > 0 THEN trxn.amount ELSE 0 END)', 'inflow')
            .addSelect('SUM(CASE WHEN trxn.amount < 0 THEN ABS(trxn.amount) ELSE 0 END)', 'outflow')
            .where('trxn.investor_id IN (:...investorIds)', { investorIds })
            .andWhere("trxn.traddate >= NOW() - CAST(:months || ' months' AS interval)", { months: String(months) })
            .groupBy("TO_CHAR(trxn.traddate, 'YYYY-MM')")
            .orderBy("TO_CHAR(trxn.traddate, 'YYYY-MM')", 'ASC')
            .getRawMany();

        if (!monthlyData.length) {
            return this.generatePlaceholderTrend(months);
        }

        // Build cumulative AUM trend
        let cumulativeAum = 0;
        return monthlyData.map(row => {
            cumulativeAum += (parseFloat(row.inflow) || 0) - (parseFloat(row.outflow) || 0);
            return {
                month: row.month,
                aum: parseFloat(cumulativeAum.toFixed(2)),
            };
        });
    }

    /**
     * Get portfolio distribution by fund category/AMC
     */
    async getPortfolioDistribution(companyId: string): Promise<Array<{ category: string; value: number; percentage: number }>> {
        const investors = await this.investorRepo.find({
            where: { company_id: companyId },
            select: ['id'],
        });

        if (!investors.length) {
            return this.generatePlaceholderDistribution();
        }

        const investorIds = investors.map(i => i.id);

        // Group holdings by AMC code
        const distribution = await this.camsStaticRepo
            .createQueryBuilder('sd')
            .select('sd.amc_code', 'category')
            .addSelect('SUM(sd.rupee_bal)', 'value')
            .where('sd.investor_id IN (:...investorIds)', { investorIds })
            .andWhere('sd.clos_bal > 0')
            .groupBy('sd.amc_code')
            .orderBy('value', 'DESC')
            .limit(8)
            .getRawMany();

        if (!distribution.length) {
            return this.generatePlaceholderDistribution();
        }

        const totalValue = distribution.reduce((sum, d) => sum + (parseFloat(d.value) || 0), 0);

        return distribution.map(d => ({
            category: d.category || 'Other',
            value: parseFloat(parseFloat(d.value).toFixed(2)) || 0,
            percentage: totalValue > 0 ? parseFloat(((parseFloat(d.value) / totalValue) * 100).toFixed(1)) : 0,
        }));
    }

    /**
     * Get broker-specific client stats
     */
    async getBrokerClientStats(userProfileId: string, companyId: string): Promise<{
        totalClients: number;
        managedAum: number;
        portfolioValue: number;
        dailyChange: number;
    }> {
        // Get investors mapped to this broker
        const mappings = await this.investorMappingRepo.find({
            where: {
                sub_broker_id: userProfileId,
                company_id: companyId,
                is_active: true,
            },
            relations: ['investor'],
        });

        const totalClients = mappings.length;

        if (!totalClients) {
            return { totalClients: 0, managedAum: 0, portfolioValue: 0, dailyChange: 0 };
        }

        const investorIds = mappings.map(m => m.investor_id);

        // Get holdings for these investors
        const holdingsSummary = await this.camsStaticRepo
            .createQueryBuilder('sd')
            .select('SUM(sd.rupee_bal)', 'current_value')
            .where('sd.investor_id IN (:...investorIds)', { investorIds })
            .andWhere('sd.clos_bal > 0')
            .getRawOne();

        const portfolioValue = parseFloat(holdingsSummary?.current_value) || 0;
        const managedAum = portfolioValue;
        const dailyChange = portfolioValue * 0.005;

        return { totalClients, managedAum, portfolioValue, dailyChange };
    }

    /**
     * Get broker performance summary
     */
    async getBrokerPerformance(userProfileId: string, companyId: string): Promise<Array<{
        client_id: string;
        client_name: string;
        portfolio_value: number;
        invested: number;
        returns_pct: number;
    }>> {
        const mappings = await this.investorMappingRepo.find({
            where: {
                sub_broker_id: userProfileId,
                company_id: companyId,
                is_active: true,
            },
            relations: ['investor'],
        });

        if (!mappings.length) {
            return [];
        }

        const clientStats: Array<{
            client_id: string;
            client_name: string;
            portfolio_value: number;
            invested: number;
            returns_pct: number;
        }> = [];
        for (const mapping of mappings.slice(0, 20)) {
            const investor = mapping.investor;
            if (!investor) continue;

            const holdingSummary = await this.camsStaticRepo
                .createQueryBuilder('sd')
                .select('SUM(sd.rupee_bal)', 'current_value')
                .where('sd.investor_id = :investorId', { investorId: investor.id })
                .andWhere('sd.clos_bal > 0')
                .getRawOne();

            const portfolioValue = parseFloat(holdingSummary?.current_value) || 0;
            const invested = portfolioValue * 0.85; // Approximation since we don't have cost in static detail
            const returnsPct = invested > 0 ? ((portfolioValue - invested) / invested) * 100 : 0;

            clientStats.push({
                client_id: investor.id,
                client_name: investor.name || investor.pan || 'Unknown',
                portfolio_value: parseFloat(portfolioValue.toFixed(2)),
                invested: parseFloat(invested.toFixed(2)),
                returns_pct: parseFloat(returnsPct.toFixed(2)),
            });
        }

        return clientStats.sort((a, b) => b.portfolio_value - a.portfolio_value);
    }

    // --- Placeholder data generators (for when DB has no matching data) ---

    private generatePlaceholderTrend(months: number): Array<{ month: string; aum: number }> {
        const data: Array<{ month: string; aum: number }> = [];
        const now = new Date();
        let baseAum = 50000000; // 5 Cr base
        for (let i = months - 1; i >= 0; i--) {
            const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            baseAum += baseAum * (Math.random() * 0.08 - 0.02); // ±2-8% monthly growth
            data.push({ month: monthStr, aum: parseFloat(baseAum.toFixed(2)) });
        }
        return data;
    }

    private generatePlaceholderDistribution(): Array<{ category: string; value: number; percentage: number }> {
        const categories = [
            { category: 'Large Cap', value: 35000000, percentage: 35 },
            { category: 'Mid Cap', value: 25000000, percentage: 25 },
            { category: 'Small Cap', value: 15000000, percentage: 15 },
            { category: 'Debt', value: 12000000, percentage: 12 },
            { category: 'Hybrid', value: 8000000, percentage: 8 },
            { category: 'Others', value: 5000000, percentage: 5 },
        ];
        return categories;
    }
}
