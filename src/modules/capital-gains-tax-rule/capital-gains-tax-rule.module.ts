import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';
import { CapitalGainsTaxRuleController } from './capital-gains-tax-rule.controller';
import { CapitalGainsTaxRuleService } from './capital-gains-tax-rule.service';

@Module({
    imports: [TypeOrmModule.forFeature([CapitalGainsTaxRule])],
    controllers: [CapitalGainsTaxRuleController],
    providers: [CapitalGainsTaxRuleService],
    exports: [CapitalGainsTaxRuleService],
})
export class CapitalGainsTaxRuleModule { }
