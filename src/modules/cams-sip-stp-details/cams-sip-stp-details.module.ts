import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamsSipStpDetail } from 'src/entities';
import { CamsSipStpDetailsController } from './cams-sip-stp-details.controller';
import { CamsSipStpDetailsService } from './cams-sip-stp-details.service';
import { CamsSipStpDetailsRepository } from './cams-sip-stp-details.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CamsSipStpDetail])],
    controllers: [CamsSipStpDetailsController],
    providers: [CamsSipStpDetailsService, CamsSipStpDetailsRepository],
    exports: [CamsSipStpDetailsService],
})
export class CamsSipStpDetailsModule { }
