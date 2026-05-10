import { Controller, Get, Post, Body, Param, Put, Delete } from '@nestjs/common';
import { CapitalGainsTaxRuleService } from './capital-gains-tax-rule.service';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';

@Controller('capital-gains-tax-rules')
export class CapitalGainsTaxRuleController {
    constructor(private readonly taxRuleService: CapitalGainsTaxRuleService) { }

    @Get()
    findAll() {
        return this.taxRuleService.findAll();
    }

    @Post()
    create(@Body() createDto: Partial<CapitalGainsTaxRule>) {
        return this.taxRuleService.create(createDto);
    }

    @Put(':id')
    update(@Param('id') id: string, @Body() updateDto: Partial<CapitalGainsTaxRule>) {
        return this.taxRuleService.update(id, updateDto);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.taxRuleService.remove(id);
    }
}
