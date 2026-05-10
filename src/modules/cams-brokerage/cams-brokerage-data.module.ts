import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamsBrokerageData } from '../../entities/cams-brokerage-data.entity';
import { CamsInvestorTransaction } from '../../entities/cams-investor-transaction.entity';
import { CamsBrokerageDataController } from './cams-brokerage-data.controller';
import { CamsBrokerageDataRepository } from './cams-brokerage-data.repository';
import { CamsBrokerageUploadService } from './cams-brokerage-upload.service';

@Module({
    imports: [TypeOrmModule.forFeature([CamsBrokerageData, CamsInvestorTransaction])],
    controllers: [CamsBrokerageDataController],
    providers: [CamsBrokerageDataRepository, CamsBrokerageUploadService],
    exports: [],
})
export class CamsBrokerageDataModule { }
