import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  BadRequestException,
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
}
