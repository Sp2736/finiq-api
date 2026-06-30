// sp2736/finiq-api/finiq-api-dbcd1714d93bf3c581b1f8f03af3a162a10a4c97/src/modules/capital-gains/capital-gains.module.ts

import { Module } from '@nestjs/common';
import { CapitalGainsController } from './capital-gains.controller';
import { CapitalGainsService } from './capital-gains.service';
import { CapitalGainsExportService } from './capital-gains-export.service';

import { InvestorModule } from '../investors/investors.module';

@Module({
  imports: [InvestorModule],
  controllers: [CapitalGainsController],
  providers: [CapitalGainsService, CapitalGainsExportService],
  exports: [CapitalGainsService]
})
export class CapitalGainsModule {}