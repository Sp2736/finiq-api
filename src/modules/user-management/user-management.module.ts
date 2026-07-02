import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserManagementController } from './user-management.controller';
import { UserManagementService } from './user-management.service';
import { SubBroker } from '../../entities/sub-broker.entity';
import { Investor } from '../../entities/investor.entity';
import { CommissionMapping } from '../../entities/commission-mapping.entity';

import { UserProfile } from '../../entities/user-profile.entity';
import { InvestorMapping } from '../../entities/investor-mapping.entity';
import { CompanyArn } from '../../entities/company-arn.entity';

import { CommonModule } from 'src/common/common.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      SubBroker,
      Investor,
      CommissionMapping,
      UserProfile,
      InvestorMapping,
      CompanyArn,
    ]),
    CommonModule,
  ],

  controllers: [UserManagementController],
  providers: [UserManagementService],
  exports: [UserManagementService],
})
export class UserManagementModule {}
