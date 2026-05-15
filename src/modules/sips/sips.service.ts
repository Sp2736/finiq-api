import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class SipsService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * COMPANY LEVEL: Gets total SIP count and groups them by Investor
   */
  async getCompanySipSummary(companyId: string) {
    try {
      const query = `
        WITH unified_sips AS (
          SELECT 
            c.investor_id, 
            inv.investor_name,
            c.amount::numeric as sip_amount
          FROM cams_sip_stp_details c
          JOIN investors inv ON c.investor_id = inv.id
          WHERE inv.company_id = $1::uuid
          
          UNION ALL
          
          SELECT 
            k.investor_id, 
            inv.investor_name,
            k.installment_amount::numeric as sip_amount
          FROM karvy_sip_registrations k
          JOIN investors inv ON k.investor_id = inv.id
          WHERE inv.company_id = $1::uuid
        )
        SELECT 
          investor_id,
          MAX(investor_name) as investor_name,
          COUNT(*) as total_sips,
          SUM(sip_amount) as total_sip_value
        FROM unified_sips
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
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch company SIP summary',
      );
    }
  }

  /**
   * INVESTOR LEVEL: Gets the specific list of SIPs for a single investor
   */
  async getInvestorSips(investorId: string) {
    try {
      const query = `
        SELECT 
          id,
          'CAMS' as source,
          scheme_name as product_name,
          folio_no,
          amount::numeric as installment_amount,
          frequency,
          status,
          start_date
        FROM cams_sip_stp_details
        WHERE investor_id = $1::uuid
        
        UNION ALL
        
        SELECT 
          id,
          'KARVY' as source,
          scheme_name as product_name,
          folio_number as folio_no,
          installment_amount::numeric,
          frequency,
          status,
          from_date as start_date
        FROM karvy_sip_registrations
        WHERE investor_id = $1::uuid
        ORDER BY start_date DESC;
      `;

      const results = await this.dataSource.query(query, [investorId]);
      return { success: true, data: results };
    } catch (error) {
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch investor SIPs',
      );
    }
  }

  /**
   * DETAIL LEVEL: Gets the exact details for the Modal (matching your screenshot)
   */
  async getSipDetail(source: string, id: string) {
    try {
      let query = '';
      if (source.toUpperCase() === 'CAMS') {
        query = `
          SELECT 
            'CAMS' as rta,
            scheme_name,
            folio_no,
            amount::numeric as sip_amount,
            start_date as from_date,
            end_date as to_date,
            frequency,
            status,
            investor_name,
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
            installment_amount::numeric as sip_amount,
            from_date,
            to_date,
            frequency,
            status,
            investor_name,
            NULL as remarks -- Adjust if Karvy has a remarks column
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
      throw new InternalServerErrorException(
        error.message || 'Failed to fetch SIP details',
      );
    }
  }
}
