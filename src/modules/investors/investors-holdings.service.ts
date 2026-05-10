import { Injectable, Logger, NotFoundException, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NavHistory } from 'src/entities/nav-history.entity';
import { Investor } from 'src/entities/investor.entity';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';
import { CamsInvestorTransaction } from 'src/entities/cams-investor-transaction.entity';
import { KarvyInvestorTransaction } from 'src/entities/karvy-investor-transaction.entity';
import { CamsSchemeDetail } from 'src/entities/cams-scheme-detail.entity';
import { KarvySchemeDetail } from 'src/entities/karvy-scheme-detail.entity';
import { FinancialUtils } from 'src/common/utils/financial.utils';
import { TaxCalculatorService } from '../tax-calculation/tax-calculator.service';

// -------------------------------------------------------------------------
// Shape returned by both DB portfolio functions
// -------------------------------------------------------------------------
interface PortfolioRow {
    investor_id: string;
    folio_no: string;
    prodcode: string;
    inv_name: string;
    sch_name: string;
    current_invested_units: string;
    avg_nav: string;
    invested_amount: string;
    current_nav: string;
    current_nav_date: string;
    current_value: string;
    yesterday_nav: string;
    todays_pnl: string;
    first_purchase_date: string | null;
    avg_days_invested: string;
    dividend_payout: string;
    redemption_swp_stp_amount: string;
    realised_gains_st: string;
    realised_gains_lt: string;
    unrealised_gains_st: string;
    unrealised_gains_lt: string;
    amfi_code: string;
    total_invested_amount: string;
    total_current_value: string;
    total_pnl: string;
    transactions: any[];   // JSONB array from DB
    is_sip?: boolean;
    sip_status?: string;
    origin: 'CAMS' | 'KARVY';
}

@Injectable()
export class InvestorsHoldingsService {
    private readonly logger = new Logger(InvestorsHoldingsService.name);

    constructor(
        @InjectRepository(Investor)
        private readonly investorRepo: Repository<Investor>,
        @InjectRepository(NavHistory)
        private readonly navRepo: Repository<NavHistory>,
        @InjectRepository(CapitalGainsTaxRule)
        private readonly taxRuleRepo: Repository<CapitalGainsTaxRule>,
        // Still needed for XIRR flow construction and portfolio-graph
        @InjectRepository(CamsInvestorTransaction)
        private readonly camsTrxnRepo: Repository<CamsInvestorTransaction>,
        @InjectRepository(KarvyInvestorTransaction)
        private readonly karvyTrxnRepo: Repository<KarvyInvestorTransaction>,
        @InjectRepository(CamsSchemeDetail)
        private readonly camsSchemeRepo: Repository<CamsSchemeDetail>,
        @InjectRepository(KarvySchemeDetail)
        private readonly karvySchemeRepo: Repository<KarvySchemeDetail>,
        private readonly taxCalculator: TaxCalculatorService,
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
    ) { }

    // -----------------------------------------------------------------------
    // fetchAndCacheCams
    // Fetches CAMS holdings + SIP status for a single investor and caches it
    // -----------------------------------------------------------------------
    private async fetchAndCacheCams(investorId: string, cacheKey: string): Promise<any[]> {
        const rows = await this.investorRepo.query(
            `SELECT cihr.*, 
                (sip.id IS NOT NULL) AS is_sip, 
                CASE 
                    WHEN sip.id IS NOT NULL THEN
                        CASE WHEN sip.cease_date IS NULL THEN 'Active' ELSE 'SIP Expired OR Terminated' END
                    ELSE NULL
                END AS sip_status
            FROM get_cams_investor_holdings_report($1::uuid[]) cihr
            LEFT JOIN LATERAL (
                SELECT id, cease_date
                FROM cams_sip_stp_details cssd
                WHERE 
                    cssd.folio_no = cihr.folio_no 
                    AND cihr.prodcode = CONCAT(cssd.amc_code, cssd.scheme_code)
                ORDER BY 
                    CASE WHEN cssd.cease_date IS NULL THEN 0 ELSE 1 END ASC,
                    cssd.id DESC
                LIMIT 1
            ) sip ON true`,
            [[investorId]]
        );
        await this.cacheManager.set(cacheKey, rows, 14400000); // 4h TTL
        return rows;
    }

    // -----------------------------------------------------------------------
    // fetchAndCacheKarvy
    // Fetches Karvy holdings + SIP status for a single investor and caches it
    // -----------------------------------------------------------------------
    private async fetchAndCacheKarvy(investorId: string, cacheKey: string): Promise<any[]> {
        const rows = await this.investorRepo.query(
            `SELECT kihr.*, 
                (sip.id IS NOT NULL) AS is_sip, 
                CASE 
                    WHEN sip.id IS NOT NULL THEN
                        CASE WHEN sip.terminate_date IS NULL THEN 'Active' ELSE 'SIP Expired OR Terminated' END
                    ELSE NULL
                END AS sip_status
            FROM get_karvy_investor_holdings_report($1::uuid[]) kihr
            LEFT JOIN LATERAL (
                SELECT id, terminate_date
                FROM karvy_sip_registrations ksr
                WHERE 
                    ksr.folio_number = kihr.folio_no 
                    AND kihr.prodcode = ksr.product_code
                ORDER BY 
                    CASE WHEN ksr.terminate_date IS NULL THEN 0 ELSE 1 END ASC,
                    ksr.id DESC
                LIMIT 1
            ) sip ON true`,
            [[investorId]]
        );
        await this.cacheManager.set(cacheKey, rows, 14400000); // 4h TTL
        return rows;
    }

    // -----------------------------------------------------------------------
    // fetchWithCache
    // Cache-first fetch for a single investor (CAMS + Karvy in parallel)
    // SIP status is included in the cached data — no extra DB call on cache hit
    // -----------------------------------------------------------------------
    private async fetchWithCache(investorId: string): Promise<[any[], any[]]> {
        const camsKey = `holdings:cams:${investorId}`;
        const karvyKey = `holdings:karvy:${investorId}`;

        const [cachedCams, cachedKarvy] = await Promise.all([
            this.cacheManager.get<any[]>(camsKey),
            this.cacheManager.get<any[]>(karvyKey),
        ]);

        return Promise.all([
            cachedCams ?? this.fetchAndCacheCams(investorId, camsKey),
            cachedKarvy ?? this.fetchAndCacheKarvy(investorId, karvyKey),
        ]);
    }

    // -----------------------------------------------------------------------
    // fetchFromDb
    // Direct DB fetch for multiple investors (no cache, includes SIP status)
    // -----------------------------------------------------------------------
    private async fetchFromDb(arrInvestorId: string[]): Promise<[any[], any[]]> {
        return Promise.all([
            this.investorRepo.query(
                `SELECT cihr.*, 
                    (sip.id IS NOT NULL) AS is_sip, 
                    CASE 
                        WHEN sip.id IS NOT NULL THEN
                            CASE WHEN sip.cease_date IS NULL THEN 'Active' ELSE 'SIP Expired OR Terminated' END
                        ELSE NULL
                    END AS sip_status
                FROM get_cams_investor_holdings_report($1::uuid[]) cihr
                LEFT JOIN LATERAL (
                    SELECT id, cease_date
                    FROM cams_sip_stp_details cssd
                    WHERE 
                        cssd.folio_no = cihr.folio_no 
                        AND cihr.prodcode = CONCAT(cssd.amc_code, cssd.scheme_code)
                    ORDER BY 
                        CASE WHEN cssd.cease_date IS NULL THEN 0 ELSE 1 END ASC,
                        cssd.id DESC
                    LIMIT 1
                ) sip ON true`,
                [arrInvestorId]
            ),
            this.investorRepo.query(
                `SELECT kihr.*, 
                    (sip.id IS NOT NULL) AS is_sip, 
                    CASE 
                        WHEN sip.id IS NOT NULL THEN
                            CASE WHEN sip.terminate_date IS NULL THEN 'Active' ELSE 'SIP Expired OR Terminated' END
                        ELSE NULL
                    END AS sip_status
                FROM get_karvy_investor_holdings_report($1::uuid[]) kihr
                LEFT JOIN LATERAL (
                    SELECT id, terminate_date
                    FROM karvy_sip_registrations ksr
                    WHERE 
                        ksr.folio_number = kihr.folio_no 
                        AND kihr.prodcode = ksr.product_code
                    ORDER BY 
                        CASE WHEN ksr.terminate_date IS NULL THEN 0 ELSE 1 END ASC,
                        ksr.id DESC
                    LIMIT 1
                ) sip ON true`,
                [arrInvestorId]
            ),
        ]);
    }

    // -----------------------------------------------------------------------
    // fetchPortfolioRows
    // Entry point — routes to cache-first (single investor) or direct DB (multiple)
    // -----------------------------------------------------------------------
    private async fetchPortfolioRows(arrInvestorId: string[]): Promise<PortfolioRow[]> {
        const [camsRows, karvyRows] = arrInvestorId.length === 1
            ? await this.fetchWithCache(arrInvestorId[0])
            : await this.fetchFromDb(arrInvestorId);

        return [
            ...camsRows.map(r => ({ ...r, origin: 'CAMS' as const })),
            ...karvyRows.map(r => ({ ...r, origin: 'KARVY' as const })),
        ].sort((a, b) => (a.sch_name || '').localeCompare(b.sch_name || ''));
    }

    // -----------------------------------------------------------------------
    // processPortfolioRows  (unchanged)
    // -----------------------------------------------------------------------
    private processPortfolioRows(portfolioRows: PortfolioRow[]) {
        const report: any[] = [];
        const allXirrFlows: { amount: number; date: Date }[] = [];
        const allTaxTransactions: Array<{
            transaction_date: Date;
            realised_gains_st: number;
            realised_gains_lt: number;
        }> = [];

        const NON_CASHFLOW_TYPES = new Set(['PLDO', 'FULD', 'UPLO', 'RMT', 'SIND']);
        const REDEMPTION_NATURES = new Set([
            'Redemption', 'Full Redemption', 'SWP', 'STP', 'Switch Out', 'Full Switch Out'
        ]);
        const REDEMPTION_CODES = new Set(['FUL', 'RED', 'SWO', 'STPD']);

        const aggregate = {
            total_capital: 0,
            invested_capital: 0,
            current_value: 0,
            dividend_payout: 0,
            unrealised_gains_st: 0,
            unrealised_gains_lt: 0,
            realised_gains_st: 0,
            realised_gains_lt: 0,
        };

        for (const row of portfolioRows) {
            const unitsHeld = parseFloat(row.current_invested_units) || 0;
            const activeInvestedCapital = parseFloat(row.invested_amount) || 0;
            const currentValue = parseFloat(row.current_value) || 0;
            const currentNav = parseFloat(row.current_nav) || 0;
            const avgNav = parseFloat(row.avg_nav) || 0;
            const yesterdayNav = parseFloat(row.yesterday_nav) || 0;
            const todaysPnl = parseFloat(row.todays_pnl) || 0;
            const navDate = row.current_nav_date ? new Date(row.current_nav_date) : new Date();
            const dividendPayout = parseFloat(row.dividend_payout) || 0;
            const redemptionSwpStp = parseFloat(row.redemption_swp_stp_amount) || 0;
            const realisedGainsSt = parseFloat(row.realised_gains_st) || 0;
            const realisedGainsLt = parseFloat(row.realised_gains_lt) || 0;
            const unrealisedGainsSt = parseFloat(row.unrealised_gains_st) || 0;
            const unrealisedGainsLt = parseFloat(row.unrealised_gains_lt) || 0;
            const avgDays = parseFloat(row.avg_days_invested) || 0;

            const todaysPnlPercent = yesterdayNav > 0 ? ((currentNav - yesterdayNav) / yesterdayNav) * 100 : 0;
            const netPnl = realisedGainsSt + realisedGainsLt + unrealisedGainsSt + unrealisedGainsLt;
            const costOfRedeemed = Math.max(0, redemptionSwpStp - (realisedGainsSt + realisedGainsLt));
            const totalDeployedCapital = activeInvestedCapital + costOfRedeemed;
            const absReturn = totalDeployedCapital > 0 ? (netPnl / totalDeployedCapital) * 100 : 0;
            const firstPurchaseDate = row.first_purchase_date ? new Date(row.first_purchase_date) : null;

            // --- Transactions mapping ---
            const transactions = (row.transactions ?? []).map((tx: any) => ({
                transaction_date: new Date(tx.transaction_date),
                transaction_type: tx.transaction_type,
                amount: parseFloat((tx.amount ?? 0).toFixed(2)),
                units: parseFloat((tx.units ?? 0).toFixed(4)),
                nav: parseFloat((tx.nav ?? 0).toFixed(4)),
                current_nav: parseFloat((tx.current_nav ?? 0).toFixed(4)),
                unrealised_gains: (currentNav * parseFloat((tx.units ?? 0).toFixed(4))) - parseFloat((tx.amount ?? 0).toFixed(2)),
                stt_and_others: parseFloat((tx.stt_and_others ?? 0).toFixed(2)),
                arn: tx.arn ?? '',
            }));

            // --- XIRR flows ---
            const xirrFlows: { amount: number; date: Date }[] = transactions
                .filter(tx => tx.amount !== 0 && !NON_CASHFLOW_TYPES.has((tx.transaction_type || '').toUpperCase().trim()))
                .map(tx => {
                    const typeUpper = (tx.transaction_type || '').toUpperCase();
                    const isOutflow =
                        tx.units < 0 ||
                        REDEMPTION_NATURES.has(tx.transaction_type) ||
                        typeUpper.includes('REDEMPTION') ||
                        typeUpper.includes('SWITCH OUT') ||
                        REDEMPTION_CODES.has(typeUpper);

                    return { amount: isOutflow ? tx.amount : -tx.amount, date: tx.transaction_date };
                });

            if (dividendPayout > 0) xirrFlows.push({ amount: dividendPayout, date: navDate });
            if (currentValue > 0) xirrFlows.push({ amount: currentValue, date: navDate });

            let xirrPercent = 0;
            try {
                if (xirrFlows.length > 1 && currentValue > 0) {
                    const raw = FinancialUtils.calculateXIRR(
                        xirrFlows.map(f => f.amount),
                        xirrFlows.map(f => f.date)
                    );
                    xirrPercent = isFinite(raw) && Math.abs(raw) <= 500 ? raw : 0;
                }
            } catch { }

            allXirrFlows.push(...xirrFlows);

            if (realisedGainsSt !== 0 || realisedGainsLt !== 0) {
                allTaxTransactions.push({ transaction_date: navDate, realised_gains_st: realisedGainsSt, realised_gains_lt: realisedGainsLt });
            }

            if (activeInvestedCapital > 0 || redemptionSwpStp > 0) {
                const fundReport = {
                    folio_number: row.folio_no,
                    fund_name: row.sch_name || 'Unknown Scheme',
                    amfi_code: row.amfi_code,
                    purchase_date: firstPurchaseDate,
                    avg_days: parseFloat(avgDays.toFixed(0)),
                    total_capital: parseFloat(activeInvestedCapital.toFixed(2)),
                    current_value: parseFloat(currentValue.toFixed(2)),
                    available_units: parseFloat(unitsHeld.toFixed(4)),
                    current_nav: currentNav,
                    avg_nav: parseFloat(avgNav.toFixed(4)),
                    dividend_payout: parseFloat(dividendPayout.toFixed(2)),
                    unrealised_gains_st: parseFloat(unrealisedGainsSt.toFixed(2)),
                    unrealised_gains_lt: parseFloat(unrealisedGainsLt.toFixed(2)),
                    realised_gains_st: parseFloat(realisedGainsSt.toFixed(2)),
                    realised_gains_lt: parseFloat(realisedGainsLt.toFixed(2)),
                    net_pnl: parseFloat(netPnl.toFixed(2)),
                    redemption_swp_switch_stp: parseFloat(redemptionSwpStp.toFixed(2)),
                    todays_pnl: parseFloat(todaysPnl.toFixed(2)),
                    todays_pnl_percent: parseFloat(todaysPnlPercent.toFixed(2)),
                    xirr_percent: parseFloat(xirrPercent.toFixed(2)),
                    abs_percent: parseFloat(absReturn.toFixed(2)),
                    is_sip: !!row.is_sip,
                    sip_status: row.sip_status || null,
                    transactions,
                };
                report.push(fundReport);

                // --- update aggregate ---
                aggregate.total_capital += fundReport.total_capital;
                aggregate.invested_capital += fundReport.total_capital;
                aggregate.current_value += fundReport.current_value;
                aggregate.dividend_payout += fundReport.dividend_payout;
                aggregate.unrealised_gains_st += fundReport.unrealised_gains_st;
                aggregate.unrealised_gains_lt += fundReport.unrealised_gains_lt;
                aggregate.realised_gains_st += fundReport.realised_gains_st;
                aggregate.realised_gains_lt += fundReport.realised_gains_lt;
            }
        }

        // Round aggregate
        for (const key of Object.keys(aggregate) as (keyof typeof aggregate)[]) {
            (aggregate as any)[key] = parseFloat((aggregate[key] as number).toFixed(2));
        }

        return { funds: report, aggregate, allXirrFlows, allTaxTransactions };
    }

    // -----------------------------------------------------------------------
    // getHoldingsReport  (unchanged)
    // -----------------------------------------------------------------------
    async getHoldingsReport(investorId: string) {
        const fullCacheKey = `holdings:full:${investorId}`;
        const cachedReport = await this.cacheManager.get(fullCacheKey);
        if (cachedReport) return cachedReport;

        // -- Tax rules & investor lookup (fast, small tables) ---------------
        const [taxRules, investor] = await Promise.all([
            this.taxRuleRepo.find({ order: { effective_from: 'ASC' } }),
            this.investorRepo.findOne({ where: { id: investorId } }),
        ]);
        if (!investor) throw new NotFoundException(`Investor ${investorId} not found`);

        const portfolioRows: PortfolioRow[] = await this.fetchPortfolioRows([investorId]);

        if (!portfolioRows.length) {
            return {
                investor_name: investor.name,
                total_capital: 0,
                invested_capital: 0,
                current_value: 0,
                dividend_payout: 0,
                unrealised_gains_st: 0,
                unrealised_gains_lt: 0,
                realised_gains_st: 0,
                realised_gains_lt: 0,
                funds: [],
            };
        }

        const { funds, aggregate, allXirrFlows, allTaxTransactions } = this.processPortfolioRows(portfolioRows);

        // -- Capital gains tax (realised) ------------------------------------
        const {
            realised_tax_stcg,
            realised_tax_ltcg,
            ltcgByFy,
        } = this.taxCalculator.calculateRealisedTax(
            allTaxTransactions,
            taxRules,
        );

        const {
            estimated_unrealised_tax_stcg,
            estimated_unrealised_tax_ltcg,
        } = this.taxCalculator.calculateUnrealisedTax(
            aggregate.unrealised_gains_st,
            aggregate.unrealised_gains_lt,
            taxRules,
            ltcgByFy,
        );

        // -- Overall today's PnL --------------------------------------------
        let overallTodaysPnl = 0;
        let overallYesterdayValue = 0;
        let overallNetPnl = 0;
        funds.forEach(fund => {
            overallTodaysPnl += fund.todays_pnl || 0;
            overallYesterdayValue += (fund.current_value || 0) - (fund.todays_pnl || 0);
            overallNetPnl += fund.net_pnl || 0;
        });
        const overallTodaysPnlPercent =
            overallYesterdayValue > 0 ? (overallTodaysPnl / overallYesterdayValue) * 100 : 0;

        const overallTotalDeployed = funds.reduce((sum, fund) => {
            const costOfRedeemed = Math.max(
                0,
                (fund.redemption_swp_switch_stp || 0)
                - ((fund.realised_gains_st || 0) + (fund.realised_gains_lt || 0))
            );
            return sum + (fund.total_capital || 0) + costOfRedeemed;
        }, 0);
        const overallAbsReturn =
            overallTotalDeployed > 0 ? (overallNetPnl / overallTotalDeployed) * 100 : 0;

        // -- Overall XIRR ---------------------------------------------------
        let overallXirrPercent = 0;
        if (allXirrFlows.length > 1 && aggregate.current_value > 0) {
            try {
                overallXirrPercent = FinancialUtils.calculateXIRR(
                    allXirrFlows.map(f => f.amount),
                    allXirrFlows.map(f => f.date),
                );
            } catch { /* fallback 0 */ }
        }

        // -- Round aggregate ------------------------------------------------
        for (const key of Object.keys(aggregate) as (keyof typeof aggregate)[]) {
            (aggregate as any)[key] = parseFloat((aggregate[key] as number).toFixed(2));
        }

        const investorName = portfolioRows[0]?.inv_name || investor.name;

        const finalResult = {
            investor_name: investorName,
            ...aggregate,
            todays_pnl_percent: parseFloat(overallTodaysPnlPercent.toFixed(2)),
            abs_percent: parseFloat(overallAbsReturn.toFixed(2)),
            xirr_percent: parseFloat(overallXirrPercent.toFixed(2)),

            realised_tax_stcg,
            realised_tax_ltcg,
            estimated_unrealised_tax_stcg,
            estimated_unrealised_tax_ltcg,

            funds: funds,
        };

        await this.cacheManager.set(fullCacheKey, finalResult, 3_600_000);
        return finalResult as any;
    }

    async getPortfolioGraph(investorId: string) {
        const cacheKey = `investor-${investorId}-portfolio-graph`;
        const cached = await this.cacheManager.get(cacheKey);
        if (cached) return cached as any;

        const investor = await this.investorRepo.findOne({ where: { id: investorId } });
        if (!investor) throw new NotFoundException(`Investor ${investorId} not found`);

        let camsTransactions = await this.camsTrxnRepo.find({
            where: { investor_id: investorId },
            order: { traddate: 'ASC' },
        });
        if (!camsTransactions.length && investor.pan) {
            camsTransactions = await this.camsTrxnRepo.find({
                where: { pan: investor.pan } as any,
                order: { traddate: 'ASC' },
            });
        }

        let karvyTransactions = await this.karvyTrxnRepo.find({
            where: { investor_id: investorId },
            order: { transaction_date: 'ASC' },
        });
        if (!karvyTransactions.length && investor.pan) {
            karvyTransactions = await this.karvyTrxnRepo.find({
                where: { pan_number: investor.pan } as any,
                order: { transaction_date: 'ASC' },
            });
        }

        const unifiedTransactions = [
            ...camsTransactions.map(t => ({
                folio_no: t.folio_no,
                prodcode: t.prodcode,
                traddate: (t.traddate || t.postdate || t.sys_regn_date || t.created_at || new Date()) as Date,
                amount: t.amount,
                units: t.units,
                trxn_nature: t.trxn_nature,
                trxntype: t.trxntype,
                origin: 'CAMS' as const,
            })),
            ...karvyTransactions.map(t => ({
                folio_no: t.folio_number,
                prodcode: t.product_code || t.scheme_code,
                traddate: (t.transaction_date || t.process_date || t.created_at || new Date()) as Date,
                amount: t.amount,
                units: t.units,
                trxn_nature: t.transaction_description || t.transaction_head,
                trxntype: t.transaction_type,
                origin: 'KARVY' as const,
            })),
        ].sort((a, b) => new Date(a.traddate).getTime() - new Date(b.traddate).getTime());

        if (!unifiedTransactions.length) return [];

        const isinCache = new Map<string, string>();
        const getIsinCached = async (prodcode: string, origin: string): Promise<string> => {
            const key = `${prodcode}_${origin}`;
            if (isinCache.has(key)) return isinCache.get(key)!;
            let isinNo = '';
            if (origin === 'CAMS') {
                const sd = await this.camsSchemeRepo
                    .createQueryBuilder('sd')
                    .where('CONCAT(sd.amc_code, sd.sch_code) = :prodcode', { prodcode })
                    .select(['sd.isin_no'])
                    .getOne();
                isinNo = sd?.isin_no || '';
            } else {
                const sd = await this.karvySchemeRepo.findOne({
                    where: { product_code: prodcode },
                    select: ['isin_number'],
                });
                isinNo = sd?.isin_number || '';
            }
            isinCache.set(key, isinNo);
            return isinNo;
        };

        const firstDate = new Date(unifiedTransactions[0].traddate);
        const endDate = new Date();
        const dataPoints: any[] = [];
        let curDate = new Date(firstDate.getFullYear(), firstDate.getMonth() + 1, 0);
        curDate.setHours(23, 59, 59, 999);
        let txIndex = 0;
        const activeLotsByScheme = new Map<string, { origin: string; lots: { units: number; cost: number }[] }>();
        let counter = 1;

        while (curDate <= endDate || dataPoints.length === 0) {
            while (txIndex < unifiedTransactions.length && new Date(unifiedTransactions[txIndex].traddate) <= curDate) {
                const tx = unifiedTransactions[txIndex];
                if (!activeLotsByScheme.has(tx.prodcode))
                    activeLotsByScheme.set(tx.prodcode, { origin: tx.origin, lots: [] });
                const slot = activeLotsByScheme.get(tx.prodcode)!;
                const nature = (tx.trxn_nature || '').toUpperCase();
                const type = (tx.trxntype || '').toUpperCase();
                const isOutflow = nature.includes('REDEMPTION') || nature.includes('SWITCH OUT') ||
                    type.includes('SELL') || Number(tx.units) < 0 || Number(tx.amount) < 0;
                const isDividend = type.includes('DIVIDEND') && nature.includes('PAYOUT');

                if (!isDividend && !isOutflow) {
                    slot.lots.push({ units: Math.abs(Number(tx.units)), cost: Math.abs(Number(tx.amount)) });
                } else if (isOutflow) {
                    let toSell = Math.abs(Number(tx.units));
                    while (toSell > 0.001 && slot.lots.length) {
                        const lot = slot.lots[0];
                        if (lot.units <= toSell) { toSell -= lot.units; slot.lots.shift(); }
                        else { lot.cost -= lot.cost * (toSell / lot.units); lot.units -= toSell; toSell = 0; }
                    }
                }
                txIndex++;
            }

            let investedCapital = 0;
            let marketValue = 0;
            for (const [prodcode, slot] of activeLotsByScheme.entries()) {
                investedCapital += slot.lots.reduce((s, l) => s + l.cost, 0);
                const unitsHeld = slot.lots.reduce((s, l) => s + l.units, 0);
                if (unitsHeld > 0.001) {
                    const isinNo = await getIsinCached(prodcode, slot.origin);
                    if (isinNo) {
                        const navInfo = await this.navRepo
                            .createQueryBuilder('n')
                            .where('(n.isinPayoutGrowth = :isin OR n.isinReinvestment = :isin)', { isin: isinNo })
                            .andWhere('n.navDate <= :d', { d: curDate })
                            .orderBy('n.navDate', 'DESC')
                            .limit(1)
                            .getOne();
                        if (navInfo) marketValue += unitsHeld * Number(navInfo.nav);
                    }
                }
            }

            dataPoints.push({
                id: (counter++).toString(),
                date: curDate.toISOString(),
                investedCapital: parseFloat(investedCapital.toFixed(2)),
                marketValue: parseFloat(marketValue.toFixed(2)),
                benchmarkValue: null,
            });

            if (curDate > endDate && txIndex >= unifiedTransactions.length) break;
            let nextMonth = new Date(curDate.getFullYear(), curDate.getMonth() + 2, 0);
            nextMonth.setHours(23, 59, 59, 999);
            if (nextMonth > endDate &&
                curDate.getMonth() === endDate.getMonth() &&
                curDate.getFullYear() === endDate.getFullYear()) {
                nextMonth = new Date(endDate);
                nextMonth.setHours(23, 59, 59, 999);
                if (curDate.getTime() === nextMonth.getTime()) break;
            }
            curDate = nextMonth;
        }

        await this.cacheManager.set(cacheKey, dataPoints, 3_600_000);
        return dataPoints;
    }

    // -----------------------------------------------------------------------
    // Capital Gains Report
    // -----------------------------------------------------------------------
    async getCapitalGainsReport(investorId: string, startDate: string, endDate: string) {
        const query = `SELECT * FROM get_capital_gains_vr($1::uuid, $2::date, $3::date)`;
        return this.investorRepo.query(query, [investorId, startDate, endDate]);
    }
}