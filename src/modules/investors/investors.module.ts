import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CamsInvestorStaticDetail,
  NavHistory,
  CamsSchemeDetail,
  CamsInvestorTransaction,
  CamsSipStpDetail,
  Investor,
} from 'src/entities';
import { KarvyInvestorMasterData } from 'src/entities/karvy-investor-master-data.entity';
import { KarvyInvestorTransaction } from 'src/entities/karvy-investor-transaction.entity';
import { KarvySipRegistration } from 'src/entities/karvy-sip-registration.entity';
import { KarvySchemeDetail } from 'src/entities/karvy-scheme-detail.entity';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { CapitalGainsTaxRule } from 'src/entities/capital-gains-tax-rule.entity';
import { CommonModule } from 'src/common/common.module';
import { TaxCalculationModule } from '../tax-calculation/tax-calculation.module';
import { InvestorController } from './investors.controller';
import { InvestorService } from './investors.service';
import { InvestorRepository } from './investors.repository';
import { InvestorsHoldingsService } from './investors-holdings.service';
import { InvestorsExportService } from './investors-export.service';

/**
 * Investor Module - Handles all investor-related operations
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Investor,
      CamsInvestorStaticDetail,
      NavHistory,
      CamsSchemeDetail,
      CamsInvestorTransaction,
      CamsSipStpDetail,
      KarvyInvestorMasterData,
      KarvyInvestorTransaction,
      KarvySipRegistration,
      KarvySchemeDetail,
      CapitalGainsTaxRule,
      InvestorMapping,
    ]),
    CommonModule,
    TaxCalculationModule,
  ],
  controllers: [InvestorController],
  providers: [
    InvestorService,
    InvestorRepository,
    InvestorsHoldingsService,
    InvestorsExportService,
  ],
  exports: [InvestorService, InvestorRepository, InvestorsHoldingsService],
})
export class InvestorModule {}
