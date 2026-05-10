import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { CamsInvestorStaticDetail } from '../entities/cams-investor-static-detail.entity';
import { CamsInvestorTransaction } from '../entities/cams-investor-transaction.entity';
import { CamsSchemeDetail } from '../entities/cams-scheme-detail.entity';
import { CamsSipStpDetail } from '../entities/cams-sip-stp-detail.entity';
import { CompanyArn } from '../entities/company-arn.entity';
import { CompanyDetail } from '../entities/company-detail.entity';
import { Company } from '../entities/company.entity';
import { Tenant } from '../entities/tenant.entity';
import { NavHistory } from '../entities/nav-history.entity';
import { EmailProcessingError } from '../entities/email-processing-error.entity';
import { Investor } from '../entities/investor.entity';

/**
 * Database configuration service
 */
@Injectable()
export class DatabaseConfigService {
  constructor(private configService: ConfigService) { }

  getTypeOrmConfig(): TypeOrmModuleOptions {
    return {
      type: 'postgres',
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_DATABASE'),
      entities: [
        Tenant,
        Company,
        CompanyDetail,
        CompanyArn,
        CamsInvestorStaticDetail,
        CamsInvestorTransaction,
        CamsSchemeDetail,
        CamsSipStpDetail,
        NavHistory,
        EmailProcessingError,
        Investor,
      ],
      //   synchronize: this.configService.get('NODE_ENV') !== 'production',
      synchronize: false,
      logging: this.configService.get('DB_LOGGING') === 'true',
      autoLoadEntities: true,
      maxQueryExecutionTime: 30000,
      connectTimeoutMS: 10000,
      ssl: {
        rejectUnauthorized: false,
      },
    };
  }
}
