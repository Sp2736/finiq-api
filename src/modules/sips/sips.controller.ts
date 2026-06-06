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
} from '@nestjs/common';
import { SipsService } from './sips.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('api/sips')
@UseGuards(JwtAuthGuard)
export class SipsController {
  constructor(private readonly sipsService: SipsService) {}

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

    const { type, status, arnIds, registrar } = body;
    const report = await this.sipsService.getSystematicReport(
      req.user,
      type,
      status,
      arnIds,
      registrar,
    );
    return { success: true, data: report };
  }
}
