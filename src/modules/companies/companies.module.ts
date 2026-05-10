import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Company } from 'src/entities/company.entity';
import { CompanyArn } from 'src/entities/company-arn.entity';
import { CompanyDetail } from 'src/entities/company-detail.entity';
import { User } from 'src/entities/user.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import { Tenant } from 'src/entities/tenant.entity';

import { CompaniesController } from './companies.controller';
import { CompaniesService } from './companies.service';
import { CompaniesRepository } from './companies.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Company,
            CompanyArn,
            CompanyDetail,
            User,
            UserProfile,
            Tenant,
        ]),
    ],
    controllers: [CompaniesController],
    providers: [CompaniesService, CompaniesRepository],
    exports: [CompaniesService],
})
export class CompaniesModule { }
