import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ApiErrorCode, ErrorMessages } from '../../common/constants/error-codes';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { SubBroker } from '../../entities/sub-broker.entity';
import { CommissionMapping } from '../../entities/commission-mapping.entity';
import { ClientMapping } from '../../entities/client-mapping.entity';
import { BrokerageLedger } from '../../entities/brokerage-ledger.entity';
import { CamsBrokerageData } from '../../entities/cams-brokerage-data.entity';
import { InvestorMapping } from '../../entities/investor-mapping.entity';
import { KarvyBrokerageData } from '../../entities/karvy-brokerage-data.entity';

@Injectable()
export class BrokerageDistributionService {
    private readonly logger = new Logger(BrokerageDistributionService.name);

    constructor(
        @InjectRepository(SubBroker)
        private readonly subBrokerRepo: Repository<SubBroker>,
        @InjectRepository(CommissionMapping)
        private readonly commissionMappingRepo: Repository<CommissionMapping>,
        @InjectRepository(ClientMapping)
        private readonly clientMappingRepo: Repository<ClientMapping>,
        @InjectRepository(BrokerageLedger)
        private readonly brokerageLedgerRepo: Repository<BrokerageLedger>,
        @InjectRepository(CamsBrokerageData)
        private readonly camsBrokerageDataRepo: Repository<CamsBrokerageData>,
        @InjectRepository(InvestorMapping)
        private readonly investorMappingRepo: Repository<InvestorMapping>,
        @InjectRepository(KarvyBrokerageData)
        private readonly karvyBrokerageDataRepo: Repository<KarvyBrokerageData>,
        private readonly dataSource: DataSource,
    ) { }

    /**
     * Fetches AMC-wise brokerage breakdown for a specific sub-broker
     */
    async getBrokerAmcBreakdown(subBrokerId: string) {
        const subBroker = await this.subBrokerRepo.findOne({
            where: { id: subBrokerId },
        });
        if (!subBroker) throw new NotFoundException(ErrorMessages[ApiErrorCode.SUB_BROKER_NOT_FOUND]);

        // Get share percentage for calculations
        const commMapping = await this.commissionMappingRepo.findOne({
            where: { sub_broker_id: subBrokerId }
        });
        const sharePercentage = commMapping ? Number(commMapping.share_percentage) : null;

        // Get investor mappings for this sub-broker
        const investorMappings = await this.investorMappingRepo.find({
            where: { sub_broker_id: subBrokerId }
        });
        const investorIds = investorMappings.map(m => m.investor_id);

        if (!investorIds.length) return [];

        // 1. CAMS Data Query
        const camsData = await this.camsBrokerageDataRepo.query(`
            SELECT 
                csd.amc AS amc_name,
                SUM(cbd.brkage_amt) AS total_brokerage
            FROM cams_brokerage_data cbd
            JOIN (
                SELECT DISTINCT amc_code, amc
                FROM cams_scheme_details
            ) csd ON csd.amc_code = cbd.amc_code
            WHERE cbd.investor_id = ANY($1)
            GROUP BY csd.amc
        `, [investorIds]);

        // 2. Karvy Data Query
        const karvyData = await this.karvyBrokerageDataRepo.query(`
            SELECT 
                ksd.amc_name,
                SUM(kbd.brokerage_in_rs) AS total_brokerage
            FROM karvy_brokerage_data kbd
            JOIN (
                SELECT DISTINCT amc_code, amc_name
                FROM karvy_scheme_details
            ) ksd ON kbd.fund = ksd.amc_code
            WHERE kbd.investor_id = ANY($1)
            GROUP BY ksd.amc_name
        `, [investorIds]);

        // 3. Normalize and Merge
        const mergeMap = new Map<string, number>();

        camsData.forEach(r => {
            const name = r.amc_name || 'Other CAMS';
            mergeMap.set(name, (mergeMap.get(name) || 0) + (Number(r.total_brokerage) || 0));
        });

        karvyData.forEach(r => {
            const name = r.amc_name || 'Other Karvy';
            mergeMap.set(name, (mergeMap.get(name) || 0) + (Number(r.total_brokerage) || 0));
        });

        // 4. Final Calculations
        return Array.from(mergeMap.entries()).map(([amc_name, gross]) => {
            const paid = sharePercentage !== null ? (gross * sharePercentage) / 100 : 0;
            const net = sharePercentage !== null ? gross - paid : gross;
            return {
                amc_name,
                gross_receivable: gross,
                paid: paid,
                net_receivable: net
            };
        });
    }

    /**
     * Lists all sub-brokers for a given company based on investor mappings
     */
    async getSubBrokers(companyId: string) {
        // We use the query provided by the user to get sub-brokers and their mappings
        // Grouping by Sub Broker ID to provide a clean list
        const query = `
            SELECT 
                s.id,
                s.name,
                s.arn_id,
                MAX(c.share_percentage) as share_percentage,
                COUNT(DISTINCT inv.id) as investor_count
            FROM sub_brokers s
            LEFT JOIN commission_mappings c ON c.sub_broker_id = s.id
            LEFT JOIN investor_mappings i ON i.sub_broker_id = s.id
            LEFT JOIN investors inv ON i.investor_id = inv.id
            WHERE s.company_id = $1 OR s.company_id IS NULL
            GROUP BY s.id, s.name, s.arn_id
            ORDER BY s.name ASC
        `;

        const data = await this.subBrokerRepo.query(query, [companyId]);
        return { data };
    }

    /**
     * Retrieves hierarchical brokerage data using raw registry tables.
     */
    async getHierarchyBrokerage(
        companyId: string,
        type: 'amc' | 'scheme' | 'client',
        month: number,
        year: number,
    ) {
        // Fallback or legacy support for the current hierarchy structure if needed
        // but the user wants to focus on the simple list now.
        // Returning empty for now to avoid errors while we transition.
        return { data: [], totals: null };
    }

    async processAllCamsBrokerage(): Promise<void> {
        // Not implemented for now as per user request to simplify
    }

    async getSubBrokerAmcAggregation(companyId: string, fromDate: string, toDate: string) {
        // Reuse the detailed logic but map it to the response format expected by this legacy endpoint
        const detailedData = await this.getDetailedBrokerageDistribution(companyId, fromDate, toDate, 'amc');

        const subBrokers = detailedData.sub_brokers.map(sb => {
            const amcList = sb.amc_wise_brokerage || [];

            // Calculate totals for this sub-broker based on the breakdown
            const totalGross = amcList.reduce((sum: number, item: any) => sum + (item.total_brokerage || 0), 0);
            const totalPaid = amcList.reduce((sum: number, item: any) => sum + (item.paid_brokerage || 0), 0);
            const totalNet = amcList.reduce((sum: number, item: any) => sum + (item.net_brokerage || 0), 0);

            return {
                sub_broker_id: sb.sub_broker_id,
                sub_broker_name: sb.sub_broker_name,
                total_gross_receivable: Number(totalGross.toFixed(2)),
                total_paid: Number(totalPaid.toFixed(2)),
                total_net_receivable: Number(totalNet.toFixed(2)),
                amc_wise_brokerage: amcList.map((amc: any) => ({
                    amc_name: amc.amc_name,
                    gross_receivable: amc.total_brokerage,
                    paid: amc.paid_brokerage,
                    net_receivable: amc.net_brokerage
                }))
            };
        });

        return {
            total_gross_receivable: detailedData.total_gross_brokerage_report,
            total_paid: detailedData.total_paid_brokerage_report,
            total_net_receivable: detailedData.total_net_brokerage_report,
            sub_brokers: subBrokers
        };
    }
    /**
     * Executes a comprehensive brokerage distribution report for a company admin.
     * Note: This data can be GROUPED BY Sub-Broker and either AMC or Investor.
     * It incorporates CAMS/Karvy raw data, sharing hierarchies, and window functions for report totals.
     */
    async getDetailedBrokerageDistribution(
        companyId: string,
        fromDate: string,
        toDate: string,
        groupBy: 'amc' | 'investor' = 'amc'
    ) {
        const amcQuery = `
        WITH broker_hierarchy AS (
            SELECT
                sb.id                   AS sub_broker_id,
                sb.name                 AS sub_broker_name,
                sb.parent_id            AS main_broker_id,
                main_sb.name            AS main_broker_name,
                cm.share_percentage,
                CASE
                    WHEN sb.parent_id IS NULL THEN 'MAIN'
                    ELSE 'SUB'
                END                     AS broker_type
            FROM sub_brokers sb
            LEFT JOIN sub_brokers main_sb
                ON main_sb.id = sb.parent_id
            LEFT JOIN commission_mappings cm
                ON  cm.broker_id     = sb.parent_id
                AND cm.sub_broker_id = sb.id
            WHERE sb.company_id = $1
        ),
        combined AS (
            -- CAMS
            SELECT
                bh.sub_broker_id,
                COALESCE(bh.sub_broker_name, 'Direct Client')  AS sub_broker_name,
                COALESCE(bh.broker_type, 'DIRECT')              AS broker_type,
                bh.main_broker_id,
                bh.main_broker_name,
                bh.share_percentage,
                csd.amc                                         AS amc_name,
                'CAMS'                                          AS source,
                SUM(cbd.brkage_amt)                             AS total_brokerage
            FROM cams_brokerage_data cbd
            INNER JOIN investors inv
                ON  inv.id         = cbd.investor_id
                AND inv.company_id = $1
            LEFT JOIN investor_mappings im
                ON im.investor_id  = cbd.investor_id
            LEFT JOIN broker_hierarchy bh
                ON bh.sub_broker_id = im.sub_broker_id
            LEFT JOIN cams_scheme_details csd
                ON  csd.amc_code  = cbd.amc_code
                AND csd.sch_code  = cbd.scheme_code
            WHERE
                cbd.proc_from_date >= $2::date
                AND cbd.proc_to_date <= $3::date
            GROUP BY
                bh.sub_broker_id, bh.sub_broker_name, bh.broker_type,
                bh.main_broker_id, bh.main_broker_name, bh.share_percentage,
                csd.amc

            UNION ALL

            -- KARVY
            SELECT
                bh.sub_broker_id,
                COALESCE(bh.sub_broker_name, 'Direct Client')  AS sub_broker_name,
                COALESCE(bh.broker_type, 'DIRECT')              AS broker_type,
                bh.main_broker_id,
                bh.main_broker_name,
                bh.share_percentage,
                ksd.amc_name                                    AS amc_name,
                'KARVY'                                         AS source,
                SUM(k.brokerage_in_rs)                          AS total_brokerage
            FROM karvy_brokerage_data k
            INNER JOIN investors inv
                ON  inv.id         = k.investor_id
                AND inv.company_id = $1
            LEFT JOIN investor_mappings im
                ON im.investor_id  = k.investor_id
            LEFT JOIN broker_hierarchy bh
                ON bh.sub_broker_id = im.sub_broker_id
            LEFT JOIN (
                SELECT product_code, MAX(amc_name) as amc_name
                FROM karvy_scheme_details
                GROUP BY product_code
            ) ksd ON ksd.product_code = k.product_code
            WHERE
                k.starting_date >= $2::date
                AND k.ending_date <= $3::date
            GROUP BY
                bh.sub_broker_id, bh.sub_broker_name, bh.broker_type,
                bh.main_broker_id, bh.main_broker_name, bh.share_percentage,
                ksd.amc_name
        ),
        with_paid AS (
            SELECT
                *,
                CASE
                    WHEN broker_type = 'DIRECT' THEN 0
                    WHEN share_percentage IS NOT NULL
                    THEN ROUND((total_brokerage * share_percentage / 100)::numeric, 2)
                    ELSE 0
                END AS paid_brokerage
            FROM combined
        ),
        final_summary AS (
             SELECT
                sub_broker_id,
                sub_broker_name,
                broker_type,
                main_broker_id,
                main_broker_name,
                share_percentage,
                JSONB_AGG(JSONB_BUILD_OBJECT(
                    'amc_name', amc_name,
                    'source', source,
                    'total_brokerage', total_brokerage,
                    'paid_brokerage', paid_brokerage,
                    'net_brokerage', ROUND((total_brokerage - paid_brokerage)::numeric, 2)
                )) AS amc_wise_brokerage,
                SUM(total_brokerage) AS sub_total_gross,
                SUM(paid_brokerage) AS sub_total_paid
            FROM with_paid
            GROUP BY sub_broker_id, sub_broker_name, broker_type, main_broker_id, main_broker_name, share_percentage
        )
        SELECT
            COALESCE(JSONB_AGG(final_summary), '[]'::jsonb) AS sub_brokers,
            SUM(sub_total_gross) AS total_gross_brokerage_report,
            SUM(sub_total_paid) AS total_paid_brokerage_report,
            ROUND((SUM(sub_total_gross) - SUM(sub_total_paid))::numeric, 2) AS total_net_brokerage_report
        FROM final_summary;
        `;

        const investorQuery = `
        WITH broker_hierarchy AS (
            SELECT
                sb.id                   AS sub_broker_id,
                sb.name                 AS sub_broker_name,
                sb.parent_id            AS main_broker_id,
                main_sb.name            AS main_broker_name,
                cm.share_percentage,
                CASE
                    WHEN sb.parent_id IS NULL THEN 'MAIN'
                    ELSE 'SUB'
                END                     AS broker_type
            FROM sub_brokers sb
            LEFT JOIN sub_brokers main_sb ON main_sb.id = sb.parent_id
            LEFT JOIN commission_mappings cm ON cm.broker_id = sb.parent_id AND cm.sub_broker_id = sb.id
            WHERE sb.company_id = $1
        ),
        combined AS (
            SELECT
                bh.sub_broker_id,
                bh.sub_broker_name,
                bh.broker_type,
                bh.main_broker_id,
                bh.main_broker_name,
                bh.share_percentage,
                inv.id                  AS investor_id,
                inv.investor_name                AS investor_name,
                SUM(cbd.brkage_amt)     AS total_brokerage
            FROM cams_brokerage_data cbd
            INNER JOIN investors inv ON inv.id = cbd.investor_id AND inv.company_id = $1
            LEFT JOIN investor_mappings im ON im.investor_id = cbd.investor_id
            LEFT JOIN broker_hierarchy bh ON bh.sub_broker_id = im.sub_broker_id
            WHERE cbd.proc_from_date >= $2::date AND cbd.proc_to_date <= $3::date
            GROUP BY bh.sub_broker_id, bh.sub_broker_name, bh.broker_type, bh.main_broker_id, bh.main_broker_name, bh.share_percentage, inv.id, inv.investor_name
            UNION ALL
            SELECT
                bh.sub_broker_id,
                bh.sub_broker_name,
                bh.broker_type,
                bh.main_broker_id,
                bh.main_broker_name,
                bh.share_percentage,
                inv.id                      AS investor_id,
                inv.investor_name                    AS investor_name,
                SUM(k.brokerage_in_rs)      AS total_brokerage
            FROM karvy_brokerage_data k
            INNER JOIN investors inv ON inv.id = k.investor_id AND inv.company_id = $1
            LEFT JOIN investor_mappings im ON im.investor_id = k.investor_id
            LEFT JOIN broker_hierarchy bh ON bh.sub_broker_id = im.sub_broker_id
            WHERE k.starting_date >= $2::date AND k.ending_date <= $3::date
            GROUP BY bh.sub_broker_id, bh.sub_broker_name, bh.broker_type, bh.main_broker_id, bh.main_broker_name, bh.share_percentage, inv.id, inv.investor_name
        ),
        per_investor AS (
            SELECT
                sub_broker_id,
                COALESCE(sub_broker_name, 'Direct Client')  AS sub_broker_name,
                COALESCE(broker_type, 'DIRECT')              AS broker_type,
                main_broker_id,
                main_broker_name,
                share_percentage,
                investor_id,
                investor_name,
                SUM(total_brokerage)                         AS total_brokerage
            FROM combined
            GROUP BY sub_broker_id, sub_broker_name, broker_type, main_broker_id, main_broker_name, share_percentage, investor_id, investor_name
        ),
        with_paid AS (
            SELECT
                *,
                CASE
                    WHEN broker_type = 'DIRECT' THEN 0
                    WHEN share_percentage IS NOT NULL THEN ROUND((total_brokerage * share_percentage / 100)::numeric, 2)
                    ELSE 0
                END AS paid_brokerage
            FROM per_investor
        ),
        final_summary AS (
            SELECT
                sub_broker_id,
                sub_broker_name,
                broker_type,
                main_broker_id,
                main_broker_name,
                share_percentage,
                JSONB_AGG(JSONB_BUILD_OBJECT(
                    'investor_id', investor_id,
                    'investor_name', investor_name,
                    'total_brokerage', total_brokerage,
                    'paid_brokerage', paid_brokerage,
                    'net_brokerage', ROUND((total_brokerage - paid_brokerage)::numeric, 2)
                )) AS investor_wise_brokerage,
                SUM(total_brokerage) AS sub_total_gross,
                SUM(paid_brokerage) AS sub_total_paid
            FROM with_paid
            GROUP BY sub_broker_id, sub_broker_name, broker_type, main_broker_id, main_broker_name, share_percentage
        )
        SELECT
            COALESCE(JSONB_AGG(final_summary), '[]'::jsonb) AS sub_brokers,
            SUM(sub_total_gross) AS total_gross_brokerage_report,
            SUM(sub_total_paid) AS total_paid_brokerage_report,
            ROUND((SUM(sub_total_gross) - SUM(sub_total_paid))::numeric, 2) AS total_net_brokerage_report
        FROM final_summary;
        `;

        const query = groupBy === 'investor' ? investorQuery : amcQuery;
        const rawData = await this.dataSource.query(query, [companyId, fromDate, toDate]);

        if (!rawData.length || !rawData[0].sub_brokers) {
            return {
                total_gross_brokerage_report: 0,
                total_paid_brokerage_report: 0,
                total_net_brokerage_report: 0,
                sub_brokers: []
            };
        }

        // The query now returns the full structure as a single row thanks to JSONB_AGG
        const result = rawData[0];
        
        return {
            total_gross_brokerage_report: Number(result.total_gross_brokerage_report) || 0,
            total_paid_brokerage_report: Number(result.total_paid_brokerage_report) || 0,
            total_net_brokerage_report: Number(result.total_net_brokerage_report) || 0,
            sub_brokers: result.sub_brokers || []
        };
    }
}
