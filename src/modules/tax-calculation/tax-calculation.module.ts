import { Module } from '@nestjs/common';
import { TaxCalculatorService } from './tax-calculator.service';

@Module({
    providers: [TaxCalculatorService],
    exports: [TaxCalculatorService],
})
export class TaxCalculationModule {}
