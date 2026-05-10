import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CamsSchemeDetail } from 'src/entities';
import { CamsSchemeDetailsController } from './cams-scheme-details.controller';
import { CamsSchemeDetailsService } from './cams-scheme-details.service';
import { CamsSchemeDetailsRepository } from './cams-scheme-details.repository';

@Module({
    imports: [TypeOrmModule.forFeature([CamsSchemeDetail])],
    controllers: [CamsSchemeDetailsController],
    providers: [CamsSchemeDetailsService, CamsSchemeDetailsRepository],
    exports: [CamsSchemeDetailsService],
})
export class CamsSchemeDetailsModule { }
