// sp2736/finiq-api/finiq-api-dbcd1714d93bf3c581b1f8f03af3a162a10a4c97/src/modules/capital-gains/capital-gains.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { CapitalGainsService } from './capital-gains.service';
import { CapitalGainsExportService } from './capital-gains-export.service';
import { CapitalGainsQueryDto } from './dto/capital-gains.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseFormatter } from 'src/common';

@Controller('api/capital-gains')
@UseGuards(JwtAuthGuard)
export class CapitalGainsController {
  constructor(
    private readonly capitalGainsService: CapitalGainsService,
    private readonly capitalGainsExportService: CapitalGainsExportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async getCapitalGains(@Body() body: CapitalGainsQueryDto) {
    const result = await this.capitalGainsService.getCapitalGains(
      body.investor_id,
      body.from_date,
      body.to_date,
    );
    return ResponseFormatter.success(
      result,
      'Capital gains retrieved successfully',
    );
  }

  @Post('export')
  @HttpCode(HttpStatus.OK)
  async exportCapitalGains(
    @Body()
    body: {
      format: 'pdf' | 'excel';
      data: any;
      fy: string;
      distributorInfo: any;
    },
    @Res() res: Response,
  ) {
    const { format, data, fy, distributorInfo } = body;

    const buffer = await this.capitalGainsExportService.exportCapitalGains(
      format,
      data,
      fy,
      distributorInfo,
    );

    // Use Title Case for the downloaded file name as well
    const investorNameFormatted = data.investorDetails?.name
      ? data.investorDetails.name
          .toLowerCase()
          .split(' ')
          .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
          .join('_')
          .replace(/[^a-zA-Z0-9_]/gi, '')
      : 'Investor';

    if (format === 'excel') {
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Capital_Gains_${investorNameFormatted}_${fy}.xlsx"`,
      );
    } else {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Capital_Gains_${investorNameFormatted}_${fy}.pdf"`,
      );
    }

    res.send(buffer);
  }
}
