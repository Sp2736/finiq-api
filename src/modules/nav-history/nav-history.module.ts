import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavHistory } from 'src/entities';
import { NavHistoryController } from './nav-history.controller';
import { NavHistoryService } from './nav-history.service';
import { NavHistoryRepository } from './nav-history.repository';
import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [HttpModule, TypeOrmModule.forFeature([NavHistory])],
    controllers: [NavHistoryController],
    providers: [NavHistoryService, NavHistoryRepository],
    exports: [NavHistoryService],
})
export class NavHistoryModule { }
