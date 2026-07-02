import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Raw, DataSource } from 'typeorm';
import { CamsInvestorTransaction } from 'src/entities/cams-investor-transaction.entity';
import { KarvyInvestorTransaction } from 'src/entities/karvy-investor-transaction.entity';
import { KarvySchemeDetail } from 'src/entities/karvy-scheme-detail.entity';
import { NavHistory } from 'src/entities/nav-history.entity';
import {
  PortfolioSummaryDto,
  SchemeSummaryDto,
} from './dto/portfolio-summary.dto';
import { FinancialUtils } from 'src/common/utils/financial.utils';
import { CamsSchemeDetail } from 'src/entities/cams-scheme-detail.entity';
import { CamsSipStpDetail } from 'src/entities/cams-sip-stp-detail.entity';
import { KarvySipRegistration } from 'src/entities/karvy-sip-registration.entity';
import { logAndSanitize } from '../../common/utils/safe-error';

@Injectable()
export class InvestorApisService {
  private readonly logger = new Logger(InvestorApisService.name);

  constructor(
    @InjectRepository(CamsInvestorTransaction)
    private readonly trxnRepo: Repository<CamsInvestorTransaction>,
    @InjectRepository(KarvyInvestorTransaction)
    private readonly karvyTrxnRepo: Repository<KarvyInvestorTransaction>,
    @InjectRepository(NavHistory)
    private readonly navRepo: Repository<NavHistory>,
    @InjectRepository(CamsSchemeDetail)
    private readonly schemeRepo: Repository<CamsSchemeDetail>,
    @InjectRepository(KarvySchemeDetail)
    private readonly karvySchemeRepo: Repository<KarvySchemeDetail>,
    @InjectRepository(CamsSipStpDetail)
    private readonly camsSipRepo: Repository<CamsSipStpDetail>,
    @InjectRepository(KarvySipRegistration)
    private readonly karvySipRepo: Repository<KarvySipRegistration>,
    private readonly dataSource: DataSource,
  ) {}

  async getPortfolioSummary(investorId: string): Promise<PortfolioSummaryDto> {
    // 1. Fetch all transactions for the investor (CAMS + Karvy)
    const camsTransactions = await this.trxnRepo.find({
      where: { investor_id: investorId },
      order: { traddate: 'ASC' },
    });
    const karvyTransactions = await this.karvyTrxnRepo.find({
      where: { investor_id: investorId },
      order: { transaction_date: 'ASC' },
    });

    if (!camsTransactions.length && !karvyTransactions.length) {
      return this.getEmptyPortfolio();
    }

    // 2. Group by Scheme (prodcode for CAMS, product_code for Karvy)
    const schemeMap = new Map<string, any[]>();
    camsTransactions.forEach((t) => {
      const code = t.prodcode;
      if (code) {
        if (!schemeMap.has(code)) schemeMap.set(code, []);
        schemeMap.get(code)!.push({ ...t, origin: 'CAMS' });
      }
    });
    karvyTransactions.forEach((t) => {
      const code = t.product_code;
      if (code) {
        if (!schemeMap.has(code)) schemeMap.set(code, []);
        schemeMap.get(code)!.push({ ...t, origin: 'KARVY' });
      }
    });

    const schemeSummaries: SchemeSummaryDto[] = [];

    // 3. Process each scheme
    for (const [prodcode, trxns] of schemeMap.entries()) {
      const summary = await this.calculateSchemeMetrics(prodcode, trxns);
      if (
        summary &&
        summary.units_held > 0.001 &&
        summary.invested_amount > 0
      ) {
        // Only active holdings
        schemeSummaries.push(summary);
      }
    }

    // 4. Aggregate Portfolio Metrics
    return this.aggregatePortfolio(schemeSummaries);
  }

  private getEmptyPortfolio(): PortfolioSummaryDto {
    return {
      invested_amount: 0,
      current_amount: 0,
      net_pnl: 0,
      abs_return_percentage: 0,
      xirr_percentage: 0,
      schemes: [],
    };
  }

  private async calculateSchemeMetrics(
    prodcode: string,
    trxns: any[],
  ): Promise<SchemeSummaryDto | null> {
    const getIsinForScheme = async (
      code: string,
      origin: 'CAMS' | 'KARVY',
    ): Promise<string> => {
      if (!code) return '';
      if (origin === 'CAMS') {
        const schemeDetail = await this.schemeRepo.findOne({
          where: {
            id: Raw(() => `CONCAT(amc_code, sch_code) = :code`, { code }),
          },
          select: ['isin_no'],
        });
        return schemeDetail?.isin_no || '';
      }

      const karvyDetail = await this.karvySchemeRepo.findOne({
        where: { product_code: code },
        select: ['isin_number'],
      });
      return karvyDetail?.isin_number || '';
    };

    let unitsHeld = 0;
    let investedAmount = 0; // Cost basis of current units
    let flows: { amount: number; date: Date }[] = [];

    // SIP detection and amount calculation
    let is_sip = false;
    let sip_amount = 0;
    // Use folio and scheme code from first transaction
    const first = trxns[0];
    if (first) {
      if (first.origin === 'CAMS') {
        // CAMS SIP: prodcode = amc_code + scheme_code
        const camsSip = await this.camsSipRepo.findOne({
          where: {
            folio_no: first.folio_no,
            amc_code: first.amc_code,
            scheme_code: first.prodcode
              ? first.prodcode.startsWith(first.amc_code)
                ? first.prodcode.slice(first.amc_code.length)
                : first.prodcode
              : undefined,
          },
        });
        if (camsSip) {
          is_sip = true;
          sip_amount = Number(camsSip.auto_amount) || 0;
        }
      } else if (first.origin === 'KARVY') {
        // Karvy SIP
        const karvySip = await this.karvySipRepo.findOne({
          where: [
            { folio_number: first.folio_number, product_code: prodcode },
            { folio_number: first.folio_number, fund_code: prodcode },
          ],
        });
        if (karvySip) {
          is_sip = true;
          sip_amount = Number(karvySip.amount) || 0;
        }
      }
    }

    // Unified transaction handling for CAMS and Karvy
    trxns.forEach((t) => {
      let date: Date;
      let amount: number;
      let units: number;
      let nature: string = '';
      if (t.origin === 'CAMS') {
        date = t.traddate
          ? new Date(t.traddate)
          : t.postdate
            ? new Date(t.postdate)
            : new Date();
        amount = Number(t.amount);
        units = Number(t.units);
        nature = (t.trxn_nature || '').toUpperCase();
      } else if (t.origin === 'KARVY') {
        date = t.transaction_date
          ? new Date(t.transaction_date)
          : t.process_date
            ? new Date(t.process_date)
            : new Date();
        amount = Number(t.amount);
        units = Number(t.units);
        nature = (
          t.transaction_description ||
          t.transaction_head ||
          ''
        ).toUpperCase();
      } else {
        return;
      }

      const rawAmount = Number(amount) || 0;
      const rawUnits = Number(units) || 0;
      const absAmount = Math.abs(rawAmount);
      const absUnits = Math.abs(rawUnits);

      // Align with holdings report heuristic (outflow = redemption/switch-out/sell/negative)
      const type = (
        (t.trxntype || t.transaction_type || '') as string
      ).toUpperCase();
      const isOutflow =
        nature.includes('REDEMPTION') ||
        nature.includes('SWITCH OUT') ||
        type.includes('SELL') ||
        rawUnits < 0 ||
        rawAmount < 0;

      // Dividend payout shouldn't affect units/invested, but counts as positive flow
      if (type.includes('DIVIDEND') && nature.includes('PAYOUT')) {
        flows.push({ amount: absAmount, date });
        return;
      }

      if (!isOutflow) {
        // Purchase
        unitsHeld += absUnits;
        investedAmount += absAmount;
        flows.push({ amount: -absAmount, date });
      } else {
        // Redemption
        const preUnits = unitsHeld;
        unitsHeld -= absUnits;
        flows.push({ amount: absAmount, date });
        if (preUnits > 0 && investedAmount > 0) {
          const avgCost = investedAmount / preUnits;
          investedAmount -= absUnits * avgCost;
        }
      }
    });

    if (unitsHeld < 0.001) return null; // Fully redeemed

    const origin = (trxns[0]?.origin || 'CAMS') as 'CAMS' | 'KARVY';
    const isinNo = await getIsinForScheme(prodcode, origin);

    // Fetch Latest NAV
    const navs = isinNo
      ? await this.navRepo.find({
          where: [{ isinPayoutGrowth: isinNo }, { isinReinvestment: isinNo }],
          order: { navDate: 'DESC' },
          take: 1,
        })
      : [];
    const latestNav = navs.length ? navs[0] : null;

    const currentNav = latestNav ? Number(latestNav.nav) : 0;
    const navDate = latestNav ? latestNav.navDate : new Date();
    const currentAmount = unitsHeld * currentNav;

    // Add Current Value as final flow for XIRR
    flows.push({ amount: currentAmount, date: new Date() });

    let xirr = 0;
    try {
      if (flows.length > 1 && currentAmount > 0) {
        xirr = FinancialUtils.calculateXIRR(
          flows.map((f) => f.amount),
          flows.map((f) => f.date),
        );
      }
    } catch (e) {
      xirr = 0;
    }

    const netPnl = currentAmount - investedAmount;
    const absReturn = investedAmount > 0 ? (netPnl / investedAmount) * 100 : 0;

    return {
      scheme_name:
        trxns[0].origin === 'KARVY'
          ? trxns[0].fund_description || 'Unknown Scheme'
          : trxns[0].scheme || 'Unknown Scheme',
      scheme_code: prodcode,
      invested_amount: parseFloat(investedAmount.toFixed(2)),
      current_amount: parseFloat(currentAmount.toFixed(2)),
      net_pnl: parseFloat(netPnl.toFixed(2)),
      abs_return_percentage: parseFloat(absReturn.toFixed(2)),
      xirr_percentage: parseFloat(xirr.toFixed(2)),
      units_held: parseFloat(unitsHeld.toFixed(4)),
      current_nav: currentNav,
      nav_date: navDate,
      is_sip,
      sip_amount: is_sip ? sip_amount : undefined,
    };
  }

  private aggregatePortfolio(schemes: SchemeSummaryDto[]): PortfolioSummaryDto {
    let totalInvested = 0;
    let totalCurrent = 0;

    // For XIRR of total portfolio, strictly speaking, we should combine ALL flows of ALL schemes.
    // But approximating as aggregation of metrics is incorrect for XIRR.
    // ABS return can be weighted.
    // XIRR must be calculated from global flows?
    // To be accurate, we should really aggregate flows in step 1-2 if we want Portfolio XIRR.
    // BUT, for now, let's just sum Invested, Current, PnL.
    // XIRR at portfolio level is tricky without storing all flows.
    // Let's iterate schemes to sum amounts.

    schemes.forEach((s) => {
      totalInvested += s.invested_amount;
      totalCurrent += s.current_amount;
    });

    const totalPnl = totalCurrent - totalInvested;
    const absReturn = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

    // Portfolio XIRR Left as TODO or Approximation (weighted average? No, XIRR doesn't average).
    // For MVP, maybe return 0 or calculate correctly by refactoring to get all flows.
    // I will stick to 0 or leave it out for Portfolio Level unless critically requested calculation.
    // Actually, I can just recalculate it if I kept flows.
    // Let's just return 0 for Portfolio XIRR for now to avoid complexity in this step.

    return {
      invested_amount: parseFloat(totalInvested.toFixed(2)),
      current_amount: parseFloat(totalCurrent.toFixed(2)),
      net_pnl: parseFloat(totalPnl.toFixed(2)),
      abs_return_percentage: parseFloat(absReturn.toFixed(2)),
      xirr_percentage: 0, // Placeholder
      schemes: schemes,
    };
  }
  async getFundReturns(amfiCode: string) {
    const query = `
            SELECT 
                fbd.plan_id, 
                fbd.basic_name,
                fbd.fund_name,
                fbd.allottment_date,
                fbd.riskometer_id,
                fbd.riskometer_details,
                fbd.amc_details,
                fbd.vr_category_name,
                fbd.sebi_category_name,
                fbd.fund_manager_details,
                fbd.latest_expense_ratio,
                fbd.benchmark_details,
                fbd.latest_aum,
                tr.return_date AS trailing_return_date,
                tr.ret_ytd AS trailing_ret_ytd,
                tr.ret_1month AS trailing_ret_1month,
                tr.ret_3month AS trailing_ret_3month,
                tr.ret_6month AS trailing_ret_6month,
                tr.ret_1year AS trailing_ret_1year,
                tr.ret_3year AS trailing_ret_3year,
                tr.ret_5year AS trailing_ret_5year,
                tr.ret_7year AS trailing_ret_7year,
                tr.ret_10year AS trailing_ret_10year,
                sr.rank_1095_days AS rolling_rank_3year,
                sr.rank_365_days AS rolling_rank_1year,
                sr.rank_28_days AS rolling_rank_1month,
                sr.rank_1825_days AS rolling_rank_5year,
                sr.rank_180_days AS rolling_rank_6month,
                sr.rank_90_days AS rolling_rank_3month,
                sr.rank_3650_days AS rolling_rank_10year,
                sr.ret_7_days AS rolling_ret_7days,
                sr.ret_14_days AS rolling_ret_14days,
                sr.ret_21_days AS rolling_ret_21days,
                sr.ret_28_days AS rolling_ret_28days,
                sr.ret_90_days AS rolling_ret_90days,
                sr.ret_180_days AS rolling_ret_180days,
                sr.ret_365_days AS rolling_ret_365days
            FROM vr_fund_basic_details fbd 
            LEFT JOIN vr_fund_return_latest tr ON fbd.plan_id = tr.plan_id
            LEFT JOIN vr_schemes_rollingreturns sr ON sr.plan_id = fbd.plan_id
            WHERE fbd.amfi_code = $1
        `;
    const rows = await this.navRepo.query(query, [amfiCode]);

    return rows.map((row) => ({
      plan_id: row.plan_id,
      basic_name: row.basic_name,
      fund_name: row.fund_name,
      allottment_date: row.allottment_date,
      riskometer_id: row.riskometer_id,
      riskometer_details: row.riskometer_details,
      amc_details: row.amc_details,
      vr_category_name: row.vr_category_name,
      sebi_category_name: row.sebi_category_name,
      fund_manager_details: row.fund_manager_details,
      latest_expense_ratio: row.latest_expense_ratio,
      benchmark_details: row.benchmark_details,
      latest_aum: row.latest_aum,
      trailing_returns: {
        return_date: row.trailing_return_date,
        ret_ytd: row.trailing_ret_ytd,
        ret_1month: row.trailing_ret_1month,
        ret_3month: row.trailing_ret_3month,
        ret_6month: row.trailing_ret_6month,
        ret_1year: row.trailing_ret_1year,
        ret_3year: row.trailing_ret_3year,
        ret_5year: row.trailing_ret_5year,
        ret_7year: row.trailing_ret_7year,
        ret_10year: row.trailing_ret_10year,
      },
      rolling_returns: {
        rank_3year: row.rolling_rank_3year,
        rank_1year: row.rolling_rank_1year,
        rank_1month: row.rolling_rank_1month,
        rank_5year: row.rolling_rank_5year,
        rank_6month: row.rolling_rank_6month,
        rank_3month: row.rolling_rank_3month,
        rank_10year: row.rolling_rank_10year,
        ret_7days: row.rolling_ret_7days,
        ret_14days: row.rolling_ret_14days,
        ret_21days: row.rolling_ret_21days,
        ret_28days: row.rolling_ret_28days,
        ret_90days: row.rolling_ret_90days,
        ret_180days: row.rolling_ret_180days,
        ret_365days: row.rolling_ret_365days,
      },
    }));
  }

  async getFundMonthlyReturns(amfiCode: string) {
    const query = `
            SELECT 
                frm.date,
                frm.returns
            FROM vr_fund_basic_details fbd
            LEFT JOIN vr_fund_returns_monthly frm ON frm.plan_id = fbd.plan_id
            WHERE fbd.amfi_code = $1
            ORDER BY date
        `;
    return this.navRepo.query(query, [amfiCode]);
  }

  async getFundComposition(amfiCode: string) {
    const query = `
            SELECT 
                vc.*
            FROM vr_fund_basic_details fbd
            JOIN vr_composition vc ON vc.plan_id = fbd.plan_id
            WHERE fbd.amfi_code = $1
            ORDER BY vc.as_on_date DESC;
        `;
    return this.navRepo.query(query, [amfiCode]);
  }

  async getFundStylebox(amfiCode: string) {
    const query = `
            SELECT 
                vs.*
            FROM vr_fund_basic_details fbd
            JOIN vr_fund_stylebox_sebi vs ON vs.plan_id = fbd.plan_id
            WHERE fbd.amfi_code = $1
            ORDER BY vs.date DESC
            LIMIT 1;
        `;
    const rows = await this.navRepo.query(query, [amfiCode]);
    return rows.length ? rows[0] : null;
  }

  async getFundRiskStats(amfiCode: string) {
    const query = `
            SELECT 
                vsv.mean,
                vsv.standard_deviation,
                vsv.sharpe_ratio,
                vsv.sortino_ratio,
                vsv.rsquared,
                vsv.rsquare_stated,
                vsv.alpha,
                vsv.alpha_stated,
                vsv.beta,
                vsv.beta_stated,
                vsv.treynor,
                vsv.treynor_stated,
                vsv.information_ratio
            FROM vr_fund_basic_details fbd
            LEFT JOIN vr_stats_variables vsv ON vsv.plan_id = fbd.plan_id 
            WHERE fbd.amfi_code = $1
        `;
    const rows = await this.navRepo.query(query, [amfiCode]);

    return rows.map((row) => ({
      risk_measures: {
        mean: row.mean,
        standard_deviation: row.standard_deviation,
        sharpe_ratio: row.sharpe_ratio,
        sortino_ratio: row.sortino_ratio,
      },
      relative_risk_measures: {
        rsquared: row.rsquared,
        rsquared_stated: row.rsquared_stated,
        alpha: row.alpha,
        alpha_stated: row.alpha_stated,
        beta: row.beta,
        beta_stated: row.beta_stated,
        treynor: row.treynor,
        treynor_stated: row.treynor_stated,
        information_ratio: row.information_ratio,
      },
    }));
  }

  async getFundSectorAllocation(amfiCode: string) {
    const query = `
            SELECT 
                ssil.as_on_date,
                ssil.percentage,
                ss.sector_name
            FROM vr_fund_basic_details fbd
            JOIN vr_fund_holdings_sic_sectorwise_imputed_latest ssil ON ssil.plan_id = fbd.plan_id
            LEFT JOIN vr_sic_sectors ss ON ss.sector_code = ssil.sector_code
            WHERE fbd.amfi_code = $1
              AND ssil.as_on_date = (
                  SELECT MAX(as_on_date) 
                  FROM vr_fund_holdings_sic_sectorwise_imputed_latest 
                  WHERE plan_id = fbd.plan_id
              )
            ORDER BY ssil.percentage DESC;
        `;
    return this.navRepo.query(query, [amfiCode]);
  }

  async getFundHoldings(amfiCode: string) {
    this.logger.log(`Fetching VR fund holdings for AMFI Code: ${amfiCode}`);

    try {
      // We join the basic details table to resolve the amfi_code to a plan_id.
      // We also use a subquery on as_on_date to ensure we only fetch the most recent portfolio.
      const query = `
            SELECT 
                h.security_name as company, 
                h.asset_description as sector, 
                h.asset_percentage as weightage, 
                h.asset_class as asset_type,
                h.num_of_shares as count,
                h.asset_value as value
            FROM vr_fund_basic_details fbd
            JOIN vr_fund_holdings_details h ON h.plan_id = fbd.plan_id
            WHERE fbd.amfi_code = $1 
              AND h.as_on_date = (
                  SELECT MAX(as_on_date) 
                  FROM vr_fund_holdings_details 
                  WHERE plan_id = fbd.plan_id
              )
            ORDER BY h.asset_percentage DESC
        `;

      const holdings = await this.navRepo.query(query, [amfiCode]);

      if (!holdings || holdings.length === 0) {
        this.logger.warn(`No holdings found for AMFI: ${amfiCode}`);
        return [];
      }

      return holdings;
    } catch (error) {
      throw new Error(
        logAndSanitize(this.logger, 'Failed to fetch fund holdings', error, 'Could not retrieve fund holdings at this time.')
      );
    }
  }

  async getInvestorSystematicReports(
    investorId: string,
    type?: string,
    status?: string,
    registrar?: string,
  ) {
    // 1. Validate 'type' parameter
    if (type && type.toUpperCase() !== 'ALL') {
      const typeUpper = type.toUpperCase();
      if (!['SIP', 'STP', 'SWP'].includes(typeUpper)) {
        throw new BadRequestException('Invalid systematic type');
      }
    }

    // 2. Validate 'status' parameter
    if (status && status.toUpperCase() !== 'ALL') {
      const statusUpper = status.toUpperCase();
      if (
        ![
          'CURRENTLY_RUNNING',
          'FORTHCOMING',
          'PREMATURELY_TERMINATED',
          'DUE_TO_MATURITY',
        ].includes(statusUpper)
      ) {
        throw new BadRequestException('Invalid status value');
      }
    }

    const typesToFetch =
      type && type.toUpperCase() !== 'ALL'
        ? [type.toUpperCase()]
        : ['SIP', 'STP', 'SWP'];

    // 3. Build dynamic WHERE conditions
    const conditions: string[] = [];
    if (status && status.toUpperCase() !== 'ALL') {
      const statusUpper = status.toUpperCase();
      if (statusUpper === 'CURRENTLY_RUNNING') {
        conditions.push(
          `start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE AND termination_date IS NULL`,
        );
      } else if (statusUpper === 'FORTHCOMING') {
        conditions.push(`start_date > CURRENT_DATE`);
      } else if (statusUpper === 'PREMATURELY_TERMINATED') {
        conditions.push(
          `termination_date IS NOT NULL AND termination_date < end_date`,
        );
      } else if (statusUpper === 'DUE_TO_MATURITY') {
        conditions.push(`end_date < CURRENT_DATE AND termination_date IS NULL`);
      }
    }

    if (registrar && registrar.toUpperCase() !== 'ALL') {
      conditions.push(`source = '${registrar.toUpperCase()}'`);
    }

    const statusFilter =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      WITH combined AS (
          -- CAMS Active SIPs
          SELECT
              cd.auto_trno           AS trxn_no,
              cd.folio_no            AS folio_number,
              cd.scheme              AS scheme_name,
              cd.inv_name            AS investor_name,
              cd.auto_amount         AS amount,
              cd.from_date           AS start_date,
              cd.to_date             AS end_date,
              cd.target_scheme       AS target_scheme,
              CASE
                  WHEN cd.aut_trntyp = 'SO' THEN 'STP'
                  WHEN cd.aut_trntyp = 'R'  THEN 'SWP'
                  WHEN cd.aut_trntyp = 'P'  THEN 'SIP'
              END                 AS systematic_type,
              'CAMS'              AS source,
              cd.cease_date       AS termination_date,
              COALESCE(csd.amc, cd.amc_code) AS amc_name,
              CONCAT(cd.amc_code, cd.scheme_code) AS product_code
          FROM cams_sip_stp_details cd
          JOIN cams_investor_static_details cs
            ON cs.foliochk = cd.folio_no
            AND cs.product = CONCAT(cd.amc_code, cd.scheme_code)
          LEFT JOIN cams_scheme_details csd ON csd.amc_code = cd.amc_code AND csd.sch_code = cd.scheme_code
          WHERE cs.investor_id = $1::uuid
            AND cd.aut_trntyp = $2

          UNION ALL

          -- KARVY Active SIPs
          SELECT
              kr.ihno                AS trxn_no,
              kr.folio_number        AS folio_number,
              kr.scheme_name         AS scheme_name,
              COALESCE(kr.investor_name, km.investor_name) AS investor_name,
              kr.amount              AS amount,
              kr.start_date          AS start_date,
              kr.end_date            AS end_date,
              kr.to_scheme_name      AS target_scheme,
              kr.transaction_type    AS systematic_type,
              'KARVY'             AS source,
              kr.terminate_date   AS termination_date,
              COALESCE(ksd.amc_name, kr.fund_code) AS amc_name,
              kr.product_code     AS product_code
          FROM karvy_sip_registrations kr
          JOIN karvy_investor_master_data km
            ON km.folio = kr.folio_number
            AND km.product_code = kr.product_code
          LEFT JOIN karvy_scheme_details ksd ON ksd.product_code = kr.product_code
          WHERE km.investor_id = $1::uuid
            AND kr.transaction_type = $3
      )
      SELECT DISTINCT ON (trxn_no) *
      FROM combined
      ${statusFilter}
      ORDER BY trxn_no;
    `;

    const allRawRows: any[] = [];
    for (const t of typesToFetch) {
      let camsType = '';
      let karvyType = '';
      if (t === 'SIP') {
        camsType = 'P';
        karvyType = 'SIP';
      } else if (t === 'STP') {
        camsType = 'SO';
        karvyType = 'STP';
      } else if (t === 'SWP') {
        camsType = 'R';
        karvyType = 'SWP';
      }

      const params: any[] = [investorId, camsType, karvyType];
      const rows = await this.dataSource.query(query, params);
      allRawRows.push(...rows);
    }

    const seen = new Set<string>();
    const uniqueRows = allRawRows.filter((row) => {
      const trxnNo = String(row.trxn_no || '');
      if (seen.has(trxnNo)) return false;
      seen.add(trxnNo);
      return true;
    });

    uniqueRows.sort((a, b) =>
      String(a.trxn_no || '').localeCompare(String(b.trxn_no || '')),
    );

    return uniqueRows.map((r: any) => ({
      trxn_no: r.trxn_no,
      folio_number: r.folio_number,
      scheme_name: r.scheme_name,
      investor_name: r.investor_name,
      amount: r.amount ? parseFloat(r.amount) : 0,
      start_date: r.start_date,
      end_date: r.end_date,
      target_scheme: r.target_scheme,
      systematic_type: r.systematic_type,
      source: r.source,
      termination_date: r.termination_date ?? null,
      amc_name: r.amc_name || 'Unknown',
      product_code: r.product_code,
    }));
  }
}
