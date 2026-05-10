import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Investor } from '../../entities/investor.entity';
import { HoldingsCacheService } from './holdings-cache.service';
import { HoldingsCacheController } from './holdings-cache.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Investor]),
  ],
  providers: [HoldingsCacheService],
  controllers: [HoldingsCacheController],
  exports: [HoldingsCacheService],
})
export class HoldingsCacheModule { }
