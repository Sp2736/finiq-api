import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BrokerageDistributionService } from './brokerage-distribution.service';
import { BrokerageDistributionController } from './brokerage-distribution.controller';
import { SubBroker } from '../../entities/sub-broker.entity';
import { CommissionMapping } from '../../entities/commission-mapping.entity';
import { ClientMapping } from '../../entities/client-mapping.entity';
import { BrokerageLedger } from '../../entities/brokerage-ledger.entity';
import { CamsBrokerageData } from '../../entities/cams-brokerage-data.entity';
import { InvestorMapping } from '../../entities/investor-mapping.entity';
import { KarvyBrokerageData } from '../../entities/karvy-brokerage-data.entity';

import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubBroker,
      CommissionMapping,
      ClientMapping,
      BrokerageLedger,
      CamsBrokerageData,
      InvestorMapping,
      KarvyBrokerageData,
    ]),
    CommonModule,
  ],
  controllers: [BrokerageDistributionController],
  providers: [BrokerageDistributionService],
  exports: [BrokerageDistributionService],
})
export class BrokerageDistributionModule {}
