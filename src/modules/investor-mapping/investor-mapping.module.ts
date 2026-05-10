import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InvestorMappingService } from './investor-mapping.service';
import { InvestorMappingController } from './investor-mapping.controller';
import { InvestorMapping } from 'src/entities/investor-mapping.entity';
import { InvestorMappingHistory } from 'src/entities/investor-mapping-history.entity';
import { Investor } from 'src/entities/investor.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            InvestorMapping,
            InvestorMappingHistory,
            Investor,
            UserProfile,
            SubBroker,
        ]),
    ],
    controllers: [InvestorMappingController],
    providers: [InvestorMappingService],
    exports: [InvestorMappingService],
})
export class InvestorMappingModule { }
