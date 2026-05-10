import { Injectable } from '@nestjs/common';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';

interface TaxTransaction {
    transaction_date: Date;
    realised_gains_st: number;
    realised_gains_lt: number;
}

@Injectable()
export class TaxCalculatorService {
    // -------------------------------------------------------
    // Helpers
    // -------------------------------------------------------
    private getApplicableRule(
        taxRules: CapitalGainsTaxRule[],
        date: Date,
        taxType: 'STCG' | 'LTCG',
        assetClass = 'EQUITY'
    ): CapitalGainsTaxRule | null {
        const applicable = taxRules
            .filter(r => r.asset_class === assetClass && r.tax_type === taxType)
            .sort(
                (a, b) =>
                    new Date(a.effective_from).getTime() -
                    new Date(b.effective_from).getTime(),
            );

        return (
            [...applicable]
                .reverse()
                .find(
                    r =>
                        new Date(r.effective_from).getTime() <= date.getTime(),
                ) || null
        );
    }

    private getTaxRate(
        taxRules: CapitalGainsTaxRule[],
        date: Date,
        isLtcg: boolean,
    ): number {
        const rule = this.getApplicableRule(
            taxRules,
            date,
            isLtcg ? 'LTCG' : 'STCG',
        );
        return rule ? Number(rule.rate_percentage) / 100 : 0;
    }

    private getExemptionLimit(
        taxRules: CapitalGainsTaxRule[],
        date: Date,
        isLtcg: boolean,
    ): number {
        const rule = this.getApplicableRule(
            taxRules,
            date,
            isLtcg ? 'LTCG' : 'STCG',
        );
        return rule ? Number(rule.exemption_limit) : 0;
    }

    private getFinancialYear(date: Date): number {
        const m = date.getMonth();
        const y = date.getFullYear();
        return m < 3 ? y - 1 : y;
    }

    // -------------------------------------------------------
    // Realised Tax Calculation
    // -------------------------------------------------------
    calculateRealisedTax(
        transactions: TaxTransaction[],
        taxRules: CapitalGainsTaxRule[],
    ) {
        let totalStcgTax = 0;
        let totalLtcgTax = 0;

        const ltcgByFy = new Map<
            number,
            { gains: number; preJuly: number; postJuly: number }
        >();

        transactions.forEach(tx => {
            // --- STCG ---
            if (tx.realised_gains_st > 0) {
                const rate = this.getTaxRate(
                    taxRules,
                    tx.transaction_date,
                    false,
                );
                totalStcgTax += tx.realised_gains_st * rate;
            }

            // --- LTCG ---
            if (tx.realised_gains_lt > 0) {
                const fy = this.getFinancialYear(tx.transaction_date);

                if (!ltcgByFy.has(fy)) {
                    ltcgByFy.set(fy, { gains: 0, preJuly: 0, postJuly: 0 });
                }

                const rec = ltcgByFy.get(fy)!;
                rec.gains += tx.realised_gains_lt;

                const cutoff = new Date('2024-07-23').getTime();

                if (tx.transaction_date.getTime() < cutoff) {
                    rec.preJuly += tx.realised_gains_lt;
                } else {
                    rec.postJuly += tx.realised_gains_lt;
                }
            }
        });

        // --- LTCG Tax Calculation with exemption ---
        for (const [fy, rec] of ltcgByFy.entries()) {
            const fyEnd = new Date(fy + 1, 2, 31);

            const exemption = this.getExemptionLimit(
                taxRules,
                fyEnd,
                true,
            );

            const taxable = Math.max(0, rec.gains - exemption);

            if (taxable > 0 && rec.gains > 0) {
                const preRate = this.getTaxRate(
                    taxRules,
                    new Date('2024-07-20'),
                    true,
                );

                const postRate = this.getTaxRate(
                    taxRules,
                    new Date('2024-07-24'),
                    true,
                );

                totalLtcgTax +=
                    (taxable * (rec.preJuly / rec.gains)) * preRate +
                    (taxable * (rec.postJuly / rec.gains)) * postRate;
            }
        }

        return {
            realised_tax_stcg: Number(totalStcgTax.toFixed(2)),
            realised_tax_ltcg: Number(totalLtcgTax.toFixed(2)),
            ltcgByFy, // useful if needed elsewhere
        };
    }

    // -------------------------------------------------------
    // Unrealised Tax Estimation
    // -------------------------------------------------------
    calculateUnrealisedTax(
        unrealisedStcg: number,
        unrealisedLtcg: number,
        taxRules: CapitalGainsTaxRule[],
        ltcgByFy: Map<number, { gains: number }>,
    ) {
        const today = new Date();

        const stcgRate = this.getTaxRate(taxRules, today, false);
        const ltcgRate = this.getTaxRate(taxRules, today, true);

        const exemption = this.getExemptionLimit(
            taxRules,
            today,
            true,
        );

        const currentFy = this.getFinancialYear(today);
        const currentFyRealised = ltcgByFy.get(currentFy)?.gains ?? 0;

        const remainingExemption = Math.max(
            0,
            exemption - currentFyRealised,
        );

        const estimatedUnrealisedLtcgTax =
            unrealisedLtcg > remainingExemption
                ? (unrealisedLtcg - remainingExemption) * ltcgRate
                : 0;

        const estimatedUnrealisedStcgTax =
            unrealisedStcg * stcgRate;

        return {
            estimated_unrealised_tax_stcg: Number(
                estimatedUnrealisedStcgTax.toFixed(2),
            ),
            estimated_unrealised_tax_ltcg: Number(
                estimatedUnrealisedLtcgTax.toFixed(2),
            ),
        };
    }
}