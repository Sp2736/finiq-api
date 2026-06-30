// sp2736/finiq-api/finiq-api-dbcd1714d93bf3c581b1f8f03af3a162a10a4c97/src/modules/capital-gains/capital-gains.controller.ts

import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Res,
  Req,
} from '@nestjs/common';
import type { Response } from 'express';
import { CapitalGainsService } from './capital-gains.service';
import { CapitalGainsExportService } from './capital-gains-export.service';
import { CapitalGainsQueryDto } from './dto/capital-gains.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { ResponseFormatter } from 'src/common';
import { InvestorService } from '../investors/investors.service';

@Controller('api/capital-gains')
@UseGuards(JwtAuthGuard)
export class CapitalGainsController {
  constructor(
    private readonly capitalGainsService: CapitalGainsService,
    private readonly capitalGainsExportService: CapitalGainsExportService,
    private readonly investorService: InvestorService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.OK)
  async getCapitalGains(
    @Body() body: CapitalGainsQueryDto,
    @Req() req: any,
  ) {
    let targetInvestorId = body.investor_id;
    if (targetInvestorId === 'me' || targetInvestorId === 'investor-id') {
      targetInvestorId = req.user.id;
    }

    const result = await this.capitalGainsService.getCapitalGains(
      targetInvestorId,
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
      investor_id: string;
      from_date: string;
      to_date: string;
      period_label: string;
      format: 'pdf' | 'excel';
      distributor_info?: any;
    },
    @Res() res: Response,
    @Req() req: any,
  ) {
    let targetInvestorId = body.investor_id;
    if (targetInvestorId === 'me' || targetInvestorId === 'investor-id') {
      targetInvestorId = req.user.id;
    }

    // Note: Authentication is handled by @UseGuards(JwtAuthGuard) at class level
    const result = await this.capitalGainsService.getCapitalGains(
      targetInvestorId,
      body.from_date,
      body.to_date,
    );

    const buffer = await this.capitalGainsExportService.exportCapitalGains(
      body.format,
      targetInvestorId,
      body.from_date,
      body.to_date,
      body.distributor_info
    );

    const rawName = result?.investor_name || 'Investor';
    const investorNameFormatted = rawName
      .toLowerCase()
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join('_')
      .replace(/[^a-zA-Z0-9_]/gi, '');

    const ext = body.format === 'excel' ? 'xlsx' : 'pdf';
    const contentType =
      body.format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf';

    res.setHeader('Content-Type', contentType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Capital_Gains_${investorNameFormatted}_${body.period_label}.${ext}"`,
    );

    res.send(buffer);
  }
}
