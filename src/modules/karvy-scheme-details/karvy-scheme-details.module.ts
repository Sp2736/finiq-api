import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { KarvySchemeDetail } from 'src/entities';
import { KarvySchemeDetailsController } from './karvy-scheme-details.controller';
import { KarvySchemeDetailsService } from './karvy-scheme-details.service';
import { CommonModule } from 'src/common/common.module';

@Module({
    imports: [TypeOrmModule.forFeature([KarvySchemeDetail]), CommonModule],
    controllers: [KarvySchemeDetailsController],
    providers: [KarvySchemeDetailsService],
    exports: [KarvySchemeDetailsService],
})
export class KarvySchemeDetailsModule { }
