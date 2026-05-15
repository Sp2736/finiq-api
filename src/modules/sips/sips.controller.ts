import {
  Controller,
  Get,
  Param,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { SipsService } from './sips.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('api/sips')
@UseGuards(JwtAuthGuard)
export class SipsController {
  constructor(private readonly sipsService: SipsService) {}

  // 1. Company Level: Grouped by Investor
  @Get('company/summary')
  async getCompanySipSummary(@Req() req: any) {
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;
    if (!companyId) throw new BadRequestException('Company ID is required');

    return this.sipsService.getCompanySipSummary(companyId);
  }

  // 2. Investor Level: List of their individual SIPs
  @Get('investor/:investorId')
  async getInvestorSips(@Param('investorId') investorId: string) {
    if (!investorId) throw new BadRequestException('Investor ID is required');
    return this.sipsService.getInvestorSips(investorId);
  }

  // 3. SIP Detail Level: Specific SIP info matching your screenshot
  @Get('detail/:source/:id')
  async getSipDetail(@Param('source') source: string, @Param('id') id: string) {
    return this.sipsService.getSipDetail(source, id);
  }
}
