import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KarvyBrokerageData, KarvyInvestorTransaction, Investor } from '../../entities';
import { KarvyBrokerageUploadService } from './karvy-brokerage-upload.service';
import { KarvyBrokerageController } from './karvy-brokerage.controller';

@Module({
    imports: [
        TypeOrmModule.forFeature([KarvyBrokerageData, KarvyInvestorTransaction, Investor]),
    ],
    controllers: [KarvyBrokerageController],
    providers: [KarvyBrokerageUploadService],
    exports: [KarvyBrokerageUploadService],
})
export class KarvyBrokerageModule { }
