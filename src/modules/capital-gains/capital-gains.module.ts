import { Module } from '@nestjs/common';
import { CapitalGainsController } from './capital-gains.controller';
import { CapitalGainsService } from './capital-gains.service';

@Module({
    controllers: [CapitalGainsController],
    providers: [CapitalGainsService],
})
export class CapitalGainsModule { }
