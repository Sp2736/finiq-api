import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';

@Injectable()
export class CapitalGainsTaxRuleService {
    constructor(
        @InjectRepository(CapitalGainsTaxRule)
        private readonly taxRuleRepo: Repository<CapitalGainsTaxRule>,
    ) { }

    async findAll() {
        return this.taxRuleRepo.find({ order: { effective_from: 'ASC' } });
    }

    async create(createDto: Partial<CapitalGainsTaxRule>) {
        const newRule = this.taxRuleRepo.create(createDto);
        return this.taxRuleRepo.save(newRule);
    }

    async update(id: string, updateDto: Partial<CapitalGainsTaxRule>) {
        const rule = await this.taxRuleRepo.findOne({ where: { id } });
        if (!rule) throw new NotFoundException('Tax rule not found');

        Object.assign(rule, updateDto);
        return this.taxRuleRepo.save(rule);
    }

    async remove(id: string) {
        const result = await this.taxRuleRepo.delete(id);
        if (result.affected === 0) throw new NotFoundException('Tax rule not found');
        return { success: true };
    }
}
