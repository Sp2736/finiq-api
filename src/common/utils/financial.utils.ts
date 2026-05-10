export class FinancialUtils {
    /**
     * Calculates XIRR (Extended Internal Rate of Return).
     * @param values Array of amounts (negative for outflow/investment, positive for inflow/redemption/current value).
     * @param dates Array of dates corresponding to the amounts.
     * @param guess Initial guess for XIRR (default 0.1).
     * @returns XIRR percentage (e.g., 12.5 for 12.5%).
     */
    static calculateXIRR(values: number[], dates: Date[], guess: number = 0.1): number {
        if (values.length !== dates.length) {
            throw new Error('Values and dates arrays must have the same length');
        }

        const xirr = this.newtonRaphson(values, dates, guess);
        return xirr * 100;
    }

    private static newtonRaphson(values: number[], dates: Date[], guess: number): number {
        const maxIterations = 100;
        const tolerance = 1e-7;
        let x0 = guess;

        for (let i = 0; i < maxIterations; i++) {
            const fValue = this.xirrFunction(values, dates, x0);
            const fDerivative = this.xirrDerivative(values, dates, x0);

            if (Math.abs(fDerivative) < tolerance) {
                return x0; // Derivative too small, return current guess
            }

            const x1 = x0 - fValue / fDerivative;

            if (Math.abs(x1 - x0) < tolerance) {
                return x1;
            }

            x0 = x1;
        }

        // If no convergence, return best guess or NaN? 
        // For now, return result even if not perfectly converged, or null.
        return x0;
    }

    private static xirrFunction(values: number[], dates: Date[], rate: number): number {
        const t0 = dates[0].getTime();
        let sum = 0;

        for (let i = 0; i < values.length; i++) {
            const dt = (dates[i].getTime() - t0) / (1000 * 60 * 60 * 24 * 365); // Years fraction
            sum += values[i] / Math.pow(1 + rate, dt);
        }

        return sum;
    }

    private static xirrDerivative(values: number[], dates: Date[], rate: number): number {
        const t0 = dates[0].getTime();
        let sum = 0;

        for (let i = 0; i < values.length; i++) {
            const dt = (dates[i].getTime() - t0) / (1000 * 60 * 60 * 24 * 365);
            sum += -values[i] * dt / Math.pow(1 + rate, dt + 1);
        }

        return sum;
    }
}
