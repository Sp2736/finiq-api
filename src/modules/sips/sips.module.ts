import { Module } from '@nestjs/common';
import { SipsController } from './sips.controller';
import { SipsService } from './sips.service';
import { SystematicReportExportService } from './systematic-report-export.service';

@Module({
  controllers: [SipsController],
  providers: [SipsService, SystematicReportExportService],
  exports: [SipsService],
})
export class SipsModule {}
