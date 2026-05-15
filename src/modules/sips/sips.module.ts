import { Module } from '@nestjs/common';
import { SipsController } from './sips.controller';
import { SipsService } from './sips.service';

@Module({
  controllers: [SipsController],
  providers: [SipsService],
  exports: [SipsService],
})
export class SipsModule {}
