import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { Investor } from 'src/entities/investor.entity';
import { CamsInvestorTransaction } from 'src/entities/cams-investor-transaction.entity';
import { CamsInvestorStaticDetail } from 'src/entities/cams-investor-static-detail.entity';
import { NavHistory } from 'src/entities/nav-history.entity';
import { CamsSchemeDetail } from 'src/entities/cams-scheme-detail.entity';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';
import { CommonModule } from 'src/common/common.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Investor,
            CamsInvestorTransaction,
            CamsInvestorStaticDetail,
            NavHistory,
            CamsSchemeDetail,
            InvestorMapping,
            UserProfile,
            SubBroker,
        ]),
        CommonModule,
    ],
    controllers: [DashboardController],
    providers: [DashboardService, DashboardRepository],
    exports: [DashboardService],
})
export class DashboardModule { }
