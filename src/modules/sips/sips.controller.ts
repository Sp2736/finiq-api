import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  BadRequestException,
  ForbiddenException,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { SipsService } from './sips.service';
import { SystematicReportExportService } from './systematic-report-export.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('api/sips')
@UseGuards(JwtAuthGuard)
export class SipsController {
  constructor(
    private readonly sipsService: SipsService,
    private readonly systematicReportExportService: SystematicReportExportService,
  ) {}

  // 1. Company Level: Grouped by Investor (Now with Search)
  @Get('company/summary')
  async getCompanySipSummary(
    @Req() req: any,
    @Query('search') search?: string,
  ) {
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;

    if (!companyId) throw new BadRequestException('Company ID is required');

    // Pass both the companyId and the optional search string to your service
    return this.sipsService.getCompanySipSummary(companyId, search);
  }

  // 2. Investor Level: List of their individual SIPs
  @Get('investor/:investorId')
  async getInvestorSips(@Param('investorId') investorId: string) {
    if (!investorId) throw new BadRequestException('Investor ID is required');
    return this.sipsService.getInvestorSips(investorId);
  }

  // 3. SIP Detail Level: Specific SIP info
  @Get('detail/:source/:id')
  async getSipDetail(@Param('source') source: string, @Param('id') id: string) {
    return this.sipsService.getSipDetail(source, id);
  }

  // 4. Systematic Report: SIP / STP / SWP report with filters (Distributor/Admin Access)
  @Post('systematic-report')
  @HttpCode(HttpStatus.OK)
  async getSystematicReport(@Body() body: any, @Req() req: any) {
    if (req.user?.type === 'investor') {
      throw new ForbiddenException(
        'Only distributors can access this endpoint',
      );
    }

    const { type, status, arnIds, registrar, investor_id, investorId } = body;
    const report = await this.sipsService.getSystematicReport(
      req.user,
      type,
      status,
      arnIds,
      registrar,
      investor_id || investorId,
    );
    return { success: true, data: report };
  }

  @Post('systematic-report/export')
  @HttpCode(HttpStatus.OK)
  async exportSystematicReport(
    @Body() body: any,
    @Req() req: any,
    @Res() res: any,
  ) {
    if (req.user?.type === 'investor') {
      throw new ForbiddenException('Only distributors can access this endpoint');
    }

    const { data, type, investorLabel, groupBy, distributor_info } = body;

    if (!Array.isArray(data)) {
      throw new BadRequestException(
        'data must be an array of systematic transaction records',
      );
    }
    if (data.length > 20000) {
      throw new BadRequestException(
        'Too many records to export in a single request (max 20000)',
      );
    }

    const pdfBuffer = this.systematicReportExportService.generatePDF(
      data,
      {
        type: type || 'All',
        investorLabel: investorLabel || 'All Investors',
        groupBy: groupBy || 'None',
      },
      distributor_info,
    );

    const safeInvestorName = String(investorLabel || 'All_Investors')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'All_Investors';
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `${safeInvestorName}-Systematic_Report_${type || 'All'}_${dateStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length,
    });
    res.end(pdfBuffer);
  }
}
