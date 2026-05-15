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
   */
  async getCompanySipSummary(companyId: string) {
    try {
      const query = `
        WITH unified_sips AS (
          -- CAMS Data 
          SELECT 
            inv.id as investor_id, 
            COALESCE(inv.investor_name, c.inv_name) as investor_name,
            COALESCE(c.auto_amount, 0)::numeric as sip_amount
          FROM cams_sip_stp_details c
          JOIN investors inv ON inv.pan_no = c.pan
          WHERE inv.company_id = $1::uuid
            AND (c.to_date IS NULL OR c.to_date >= CURRENT_DATE)
            AND (c.cease_date IS NULL OR c.cease_date >= CURRENT_DATE) -- CAMS premature termination check
          
          UNION ALL
          
          -- Karvy Data
          SELECT 
            k.investor_id, 
            COALESCE(inv.investor_name, k.investor_name) as investor_name,
            COALESCE(k.amount, 0)::numeric as sip_amount
          FROM karvy_sip_registrations k
          JOIN investors inv ON k.investor_id = inv.id
          WHERE inv.company_id = $1::uuid
            AND (k.end_date IS NULL OR k.end_date >= CURRENT_DATE)
            AND (k.terminate_date IS NULL OR k.terminate_date >= CURRENT_DATE) -- KARVY premature termination check
        )
        SELECT 
          investor_id,
          MAX(investor_name) as investor_name,
          COUNT(*) as total_sips,
          SUM(sip_amount) as total_sip_value
        FROM unified_sips
        WHERE investor_id IS NOT NULL
        GROUP BY investor_id
        ORDER BY total_sip_value DESC;
      `;

      const results = await this.dataSource.query(query, [companyId]);

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
        -- CAMS
        SELECT 
          c.id,
          'CAMS' as source,
          c.scheme as product_name,
          c.folio_no,
          c.auto_amount::numeric as installment_amount,
          c.periodicity as frequency,
          'ACTIVE' as status,
          c.from_date as start_date
        FROM cams_sip_stp_details c
        JOIN investors inv ON inv.pan_no = c.pan
        WHERE inv.id = $1::uuid
          AND (c.to_date IS NULL OR c.to_date >= CURRENT_DATE)
          AND (c.cease_date IS NULL OR c.cease_date >= CURRENT_DATE) -- CAMS premature termination check
        
        UNION ALL
        
        -- KARVY
        SELECT 
          k.id,
          'KARVY' as source,
          k.scheme_name as product_name,
          k.folio_number as folio_no,
          k.amount::numeric as installment_amount,
          k.frequency,
          k.status,
          k.start_date
        FROM karvy_sip_registrations k
        WHERE k.investor_id = $1::uuid
          AND (k.end_date IS NULL OR k.end_date >= CURRENT_DATE)
          AND (k.terminate_date IS NULL OR k.terminate_date >= CURRENT_DATE) -- KARVY premature termination check
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
            status,
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
