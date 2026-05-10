import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestorApisController } from './investor-apis.controller';
import { InvestorApisService } from './investor-apis.service';

import { CamsInvestorTransaction } from 'src/entities/cams-investor-transaction.entity';
import { KarvyInvestorTransaction } from 'src/entities/karvy-investor-transaction.entity';
import { NavHistory } from 'src/entities/nav-history.entity';
import { CamsSchemeDetail } from 'src/entities/cams-scheme-detail.entity';
import { KarvySchemeDetail } from 'src/entities/karvy-scheme-detail.entity';
import { CamsSipStpDetail } from 'src/entities/cams-sip-stp-detail.entity';
import { KarvySipRegistration } from 'src/entities/karvy-sip-registration.entity';

import { InvestorModule } from '../investors/investors.module';

import { FundAnalyticsController } from './fund-analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CamsInvestorTransaction,
      KarvyInvestorTransaction,
      NavHistory,
      CamsSchemeDetail,
      KarvySchemeDetail,
      CamsSipStpDetail,
      KarvySipRegistration
    ]),
    InvestorModule,
  ],
  controllers: [InvestorApisController, FundAnalyticsController],
  providers: [InvestorApisService],
})
export class InvestorApisModule {}