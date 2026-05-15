import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '@nestjs/cache-manager';
import { ScheduleModule } from '@nestjs/schedule';
import { redisStore } from 'cache-manager-redis-yet';
import { DatabaseModule } from './database/database.module';
import { CommonModule } from './common/common.module';
import { InvestorModule } from './modules/investors/investors.module';
import { CamsInvestorStaticDetailsModule } from './modules/cams-investor-static-details/cams-investor-static-details.module';
import { CamsInvestorTransactionsModule } from './modules/cams-investor-transactions/cams-investor-transactions.module';
import { CamsSipStpDetailsModule } from './modules/cams-sip-stp-details/cams-sip-stp-details.module';
import { CamsSchemeDetailsModule } from './modules/cams-scheme-details/cams-scheme-details.module';
import { NavHistoryModule } from './modules/nav-history/nav-history.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticationModule } from './modules/auth/authentication.module';
import { InvestorMappingModule } from './modules/investor-mapping/investor-mapping.module';
import { InvestorAuthModule } from './modules/investor-auth/investor-auth.module';
import { InvestorApisModule } from './modules/investor-apis/investor-apis.module';
import { KarvySchemeDetailsModule } from './modules/karvy-scheme-details/karvy-scheme-details.module';
import { CamsBrokerageDataModule } from './modules/cams-brokerage/cams-brokerage-data.module';
import { KarvyBrokerageModule } from './modules/karvy-brokerage/karvy-brokerage.module';
import { CapitalGainsTaxRuleModule } from './modules/capital-gains-tax-rule/capital-gains-tax-rule.module';
import { BrokerageDistributionModule } from './modules/brokerage-distribution/brokerage-distribution.module';
import { UserManagementModule } from './modules/user-management/user-management.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CapitalGainsModule } from './modules/capital-gains/capital-gains.module';
import { HoldingsCacheModule } from './modules/holdings-cache/holdings-cache.module';
import { ScrapingModule } from './modules/scraping/scraping.module';
import { BullModule } from '@nestjs/bull';
import { BrokerTransactionsModule } from './modules/broker-transactions/broker-transactions.module';
import { BankAccountsModule } from './modules/bank-accounts/bank-accounts.module';
import { SipsModule } from './modules/sips/sips.module';

@Module({
  imports: [

    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    CacheModule.register<any>({
      isGlobal: true,
      store: redisStore,
      host: '127.0.0.1',
      port: 6379,
      ttl: 3600000,
    }),
    DatabaseModule,
    CommonModule,
    InvestorModule,
    CamsInvestorStaticDetailsModule,
    CamsInvestorTransactionsModule,
    CamsSipStpDetailsModule,
    CamsSchemeDetailsModule,
    NavHistoryModule,
    CompaniesModule,
    AuthenticationModule,
    InvestorMappingModule,
    InvestorAuthModule,
    InvestorApisModule,
    KarvySchemeDetailsModule,
    CamsBrokerageDataModule,
    KarvyBrokerageModule,
    CapitalGainsTaxRuleModule,
    BrokerageDistributionModule,
    UserManagementModule,
    DashboardModule,
    CapitalGainsModule,
    HoldingsCacheModule,
    ScrapingModule,
    BullModule.forRoot({
      redis: {
        host: 'localhost',
        port: 6379,
      },
    }),
    BrokerTransactionsModule,
    BankAccountsModule,
    SipsModule,
  ],

  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
