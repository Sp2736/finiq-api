import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { BaseService } from 'src/common/base/base.service';

@Injectable()
export class CapitalGainsService extends BaseService<any, any, any> {
    constructor(private dataSource: DataSource) {
        super();
    }

    async getCapitalGains(investorId: string, fromDate: string, toDate: string) {
        try {
            const result = await this.dataSource.query(
                `SELECT get_capital_gains($1, $2, $3)`,
                [investorId, fromDate, toDate]
            );

            if (result && result.length > 0) {
                // The function returns a JSON array in the first column of the first row
                const rawData = result[0].get_capital_gains;
                const rows = typeof rawData === 'string' ? JSON.parse(rawData) : rawData;

                if (!rows || rows.length === 0) {
                    return { investor_id: investorId, investor_name: null, gains_data: [] };
                }

                const investor_name = rows[0].investor_name;
                const groups = new Map<string, any>();

                for (const row of rows) {
                    const key = `${row.folio_number}_${row.isin_no}`;
                    if (!groups.has(key)) {
                        groups.set(key, {
                            folio_number: row.folio_number,
                            scheme_name: row.scheme_name,
                            isin_no: row.isin_no,
                            transactions: []
                        });
                    }

                    // Remove redundant grouping fields from individual transactions
                    const { folio_number, scheme_name, isin_no, investor_name: invName, investor_id: invId, ...transactionData } = row;
                    groups.get(key).transactions.push(transactionData);
                }

                return {
                    investor_id: investorId,
                    investor_name,
                    gains_data: Array.from(groups.values())
                };
            }
            return { investor_id: investorId, investor_name: null, gains_data: [] };
        } catch (error) {
            await this.handleError(error, 'getCapitalGains');
        }
    }
}