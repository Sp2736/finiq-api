import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamsInvestorStaticDetail } from 'src/entities';
import { CamsInvestorStaticDetailsController } from './cams-investor-static-details.controller';
import { CamsInvestorStaticDetailsService } from './cams-investor-static-details.service';
import { CamsInvestorStaticDetailsRepository } from './cams-investor-static-details.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CamsInvestorStaticDetail])],
    controllers: [CamsInvestorStaticDetailsController],
    providers: [CamsInvestorStaticDetailsService, CamsInvestorStaticDetailsRepository],
    exports: [CamsInvestorStaticDetailsService],
})
export class CamsInvestorStaticDetailsModule { }
