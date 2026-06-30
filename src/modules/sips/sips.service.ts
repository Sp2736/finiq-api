import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SipsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * COMPANY LEVEL: Gets total ACTIVE SIP count and groups them by Investor
   * Added search parameter for frontend filtering.
   */
  async getCompanySipSummary(companyId: string, search?: string) {
    try {
      const query = `
        WITH unified_sips AS (
          -- CAMS Active SIPs
          SELECT
            cs.investor_id as investor_id,
            COALESCE(inv.investor_name, cd.inv_name) as investor_name,
            COALESCE(cd.auto_amount, 0)::numeric as sip_amount
          FROM cams_investor_static_details cs
          JOIN cams_sip_stp_details cd
            ON cs.foliochk = cd.folio_no
            AND cs.product = CONCAT(cd.amc_code, cd.scheme_code)
          JOIN investors inv
            ON inv.id = cs.investor_id
          WHERE inv.company_id = $1::uuid
            AND cd.cease_date IS NULL

          UNION ALL

          -- KARVY Active SIPs
          SELECT
            km.investor_id as investor_id,
            COALESCE(inv.investor_name, kr.investor_name) as investor_name,
            COALESCE(kr.amount, 0)::numeric as sip_amount
          FROM karvy_investor_master_data km
          JOIN karvy_sip_registrations kr
            ON km.folio = kr.folio_number
            AND km.product_code = kr.product_code
          JOIN investors inv
            ON inv.id = km.investor_id
          WHERE inv.company_id = $1::uuid
            AND kr.terminate_date IS NULL
            AND (
              LOWER(kr.status) LIKE '%live%'
              OR LOWER(kr.status) LIKE '%active%'
            )
        )

        SELECT
          investor_id,
          MAX(investor_name) as investor_name,
          COUNT(*) as total_sips,
          SUM(sip_amount) as total_sip_value
        FROM unified_sips
        WHERE investor_id IS NOT NULL
          -- Apply search filter dynamically if provided
          AND ($2::text IS NULL OR investor_name ILIKE $2)
        GROUP BY investor_id
        ORDER BY total_sip_value DESC;
      `;

      // If a search term exists, wrap it in % wildcards for partial matching. Otherwise pass null.
      const searchParam = search ? `%${search}%` : null;

      const results = await this.dataSource.query(query, [
        companyId,
        searchParam,
      ]);

      const totalSips = results.reduce(
        (acc, curr) => acc + Number(curr.total_sips),
        0,
      );
      const totalValue = results.reduce(
        (acc, curr) => acc + Number(curr.total_sip_value),
        0,
      );

      return {
        success: true,
        data: {
          total_company_sips: totalSips,
          total_company_value: totalValue,
          investor_breakdown: results,
        },
      };
    } catch (error) {
      console.error('SIP Summary Error:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch company SIP summary',
      );
    }
  }

  /**
   * INVESTOR LEVEL: Gets the specific list of ACTIVE SIPs for a single investor
   */
  async getInvestorSips(investorId: string) {
    try {
      const query = `
        -- CAMS Active SIPs
        SELECT 
          cd.id,
          'CAMS' as source,
          cd.scheme as product_name,
          cd.folio_no,
          cd.auto_amount::numeric as installment_amount,
          cd.periodicity as frequency,
          'ACTIVE' as status,
          cd.from_date as start_date
        FROM cams_investor_static_details cs
        JOIN cams_sip_stp_details cd
          ON cs.foliochk = cd.folio_no
          AND cs.product = CONCAT(cd.amc_code, cd.scheme_code)
        WHERE cs.investor_id = $1::uuid
          AND cd.cease_date IS NULL

        UNION ALL

        -- KARVY Active SIPs
        SELECT
          kr.id,
          'KARVY' as source,
          kr.scheme_name as product_name,
          kr.folio_number as folio_no,
          kr.amount::numeric as installment_amount,
          kr.frequency,
          'ACTIVE' as status,
          kr.start_date
        FROM karvy_investor_master_data km
        JOIN karvy_sip_registrations kr
          ON km.folio = kr.folio_number
          AND km.product_code = kr.product_code
        WHERE km.investor_id = $1::uuid
          AND kr.terminate_date IS NULL
          AND (
            LOWER(kr.status) LIKE '%live%'
            OR LOWER(kr.status) LIKE '%active%'
          )

        ORDER BY start_date DESC;
      `;

      const results = await this.dataSource.query(query, [investorId]);
      return { success: true, data: results };
    } catch (error) {
      console.error('Investor SIPs Error:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch investor SIPs',
      );
    }
  }

  /**
   * DETAIL LEVEL: Gets the exact details for the Modal
   */
  async getSipDetail(source: string, id: string) {
    try {
      let query = '';
      if (source.toUpperCase() === 'CAMS') {
        query = `
          SELECT 
            'CAMS' as rta,
            scheme as scheme_name,
            folio_no,
            auto_amount::numeric as sip_amount,
            from_date,
            to_date,
            periodicity as frequency,
            'ACTIVE' as status,
            inv_name as investor_name,
            remarks
          FROM cams_sip_stp_details
          WHERE id = $1::uuid
        `;
      } else if (source.toUpperCase() === 'KARVY') {
        query = `
          SELECT 
            'KARVY' as rta,
            scheme_name,
            folio_number as folio_no,
            amount::numeric as sip_amount,
            start_date as from_date,
            end_date as to_date,
            frequency,
            TRIM(status) as status,
            investor_name,
            NULL as remarks
          FROM karvy_sip_registrations
          WHERE id = $1::uuid
        `;
      } else {
        throw new BadRequestException('Invalid RTA Source');
      }

      const results = await this.dataSource.query(query, [id]);

      if (!results.length) {
        throw new NotFoundException('SIP record not found');
      }

      return { success: true, data: results[0] };
    } catch (error) {
      console.error('SIP Detail Error:', error);
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch SIP details',
      );
    }
  }

  /**
   * Generates systematic reports (SIP / STP / SWP) for distributor/admin access.
   */
  async getSystematicReport(
    user: any,
    type?: string,
    status?: string,
    arnIds?: string[],
    registrar?: string, // <-- Added registrar parameter
  ) {
    const companyId =
      user?.roles?.find((r: any) => r.company_id)?.company_id ||
      user?.company_id;

    if (!companyId) {
      throw new BadRequestException('Company ID not found in user context');
    }

    // 1. Validate 'type' parameter
    if (type) {
      const typeUpper = type.toUpperCase();
      if (!['SIP', 'STP', 'SWP'].includes(typeUpper)) {
        throw new BadRequestException('Invalid systematic type');
      }
    }

    // 2. Validate 'status' parameter
    if (status) {
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

    // 3. Validate 'arnIds' parameter
    const hasArnFilter = arnIds && arnIds.length > 0;
    if (hasArnFilter) {
      const uuidRegex =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      for (const id of arnIds) {
        if (!uuidRegex.test(id)) {
          throw new BadRequestException(`Invalid ARN ID format: ${id}`);
        }
      }
    }

    // Determine types to fetch (single type query run in parallel/sequence for 'ALL')
    const typesToFetch = type ? [type.toUpperCase()] : ['SIP', 'STP', 'SWP'];

    const arnCondition = hasArnFilter ? 'AND id = ANY($4::uuid[])' : '';

    let statusFilter = '';
    if (status) {
      const statusUpper = status.toUpperCase();
      if (statusUpper === 'CURRENTLY_RUNNING') {
        statusFilter =
          'WHERE start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE AND termination_date IS NULL';
      } else if (statusUpper === 'FORTHCOMING') {
        statusFilter = 'WHERE start_date > CURRENT_DATE';
      } else if (statusUpper === 'PREMATURELY_TERMINATED') {
        statusFilter =
          'WHERE termination_date IS NOT NULL AND termination_date < end_date';
      } else if (statusUpper === 'DUE_TO_MATURITY') {
        statusFilter =
          'WHERE end_date < CURRENT_DATE AND termination_date IS NULL';
      }
    }

    // 4. Registrar Filtering
    let camsCondition = '';
    let karvyCondition = '';
    if (registrar) {
      const regUpper = registrar.toUpperCase();
      if (regUpper === 'CAMS') {
        karvyCondition = 'AND 1=0';
      } else if (regUpper === 'KARVY') {
        camsCondition = 'AND 1=0';
      }
    }

    const query = `
WITH company_arns_filter AS (
    SELECT id FROM company_arns
    WHERE company_id = $1::uuid
      ${arnCondition}
),
combined AS (
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
        cd.amc_code         AS amc_code
    FROM cams_sip_stp_details cd
    WHERE cd.company_arn_id IN (SELECT id FROM company_arns_filter)
      AND cd.aut_trntyp = $2
      ${camsCondition}

    UNION ALL

    SELECT
        kr.ihno                AS trxn_no,
        kr.folio_number        AS folio_number,
        kr.scheme_name         AS scheme_name,
        kr.investor_name       AS investor_name,
        kr.amount              AS amount,
        kr.start_date          AS start_date,
        kr.end_date            AS end_date,
        kr.to_scheme_name      AS target_scheme,
        kr.transaction_type    AS systematic_type,
        'KARVY'             AS source,
        kr.terminate_date   AS termination_date,
        kr.fund_code        AS amc_code
    FROM karvy_sip_registrations kr
    WHERE kr.company_arn_id IN (SELECT id FROM company_arns_filter)
      AND kr.transaction_type = $3
      ${karvyCondition}
)
SELECT DISTINCT ON (trxn_no)
    *
FROM combined
${statusFilter}
ORDER BY trxn_no;
    `;
// todo: join cams with cams_scheme_details on amc_code, to fetch the amc as amc_name
// todo: join karvy with karvy_scheme_details on amc_code, to fetch the amc as amc_name

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

      const params: any[] = [companyId, camsType, karvyType];
      if (hasArnFilter) {
        params.push(arnIds);
      }

      const rows = await this.dataSource.query(query, params);
      allRawRows.push(...rows);
    }

    // Deduplicate in JS in case of overlapping trxn_no across different types
    const seen = new Set<string>();
    const uniqueRows = allRawRows.filter((row) => {
      const trxnNo = String(row.trxn_no || '');
      if (seen.has(trxnNo)) {
        return false;
      }
      seen.add(trxnNo);
      return true;
    });

    // Sort by trxn_no ascending to preserve database ordering behavior
    uniqueRows.sort((a, b) => {
      const valA = String(a.trxn_no || '');
      const valB = String(b.trxn_no || '');
      return valA.localeCompare(valB);
    });

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
      amc_code: r.amc_code || 'Unknown',
    }));
  }
}
