import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  Req,
  Body,
  BadRequestException,
} from '@nestjs/common';
import { BrokerageDistributionService } from './brokerage-distribution.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { ApiErrorCode, ErrorMessages } from 'src/common/constants/error-codes';

@Controller('api/brokerage-distribution')
@UseGuards(JwtAuthGuard, RoleGuard)
@Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN)
export class BrokerageDistributionController {
  constructor(
    private readonly distributionService: BrokerageDistributionService,
  ) {}

  @Get('hierarchy')
  async getHierarchy(
    @Query('companyId') companyId: string,
    @Query('type') type: 'amc' | 'scheme' | 'client',
    @Query('month') month: string,
    @Query('year') year: string,
  ) {
    return this.distributionService.getHierarchyBrokerage(
      companyId,
      type || 'amc',
      parseInt(month) || new Date().getMonth() + 1,
      parseInt(year) || new Date().getFullYear(),
    );
  }

  @Get('sub-brokers')
  async getSubBrokers(@Query('companyId') companyId: string) {
    return this.distributionService.getSubBrokers(companyId);
  }

  @Get('subbroker/:id/amc-breakdown')
  async getSubBrokerBreakdown(@Param('id') id: string) {
    return this.distributionService.getBrokerAmcBreakdown(id);
  }

  @Post('process-all')
  async processAll() {
    await this.distributionService.processAllCamsBrokerage();
    return {
      message: 'Brokerage distribution processing initiated successfully',
    };
  }

  @Get('subbroker-amc')
  async getSubBrokerAmc(
    @Req() req: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    if (!fromDate || !toDate) {
      throw new BadRequestException(
        ErrorMessages[ApiErrorCode.QUERY_PARAMS_REQUIRED],
      );
    }
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;
    if (!companyId) {
      throw new BadRequestException(
        ErrorMessages[ApiErrorCode.COMPANY_ID_NOT_FOUND],
      );
    }
    return this.distributionService.getSubBrokerAmcAggregation(
      companyId,
      fromDate,
      toDate,
    );
  }

  @Get('detailed-summary')
  async getDetailedSummary(
    @Req() req: any,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('groupBy') groupBy: 'amc' | 'investor' = 'amc',
  ) {
    if (!fromDate || !toDate) {
      throw new BadRequestException(
        ErrorMessages[ApiErrorCode.QUERY_PARAMS_REQUIRED],
      );
    }
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;
    return this.distributionService.getDetailedBrokerageDistribution(
      companyId,
      fromDate,
      toDate,
      groupBy,
    );
  }

  // ─── NEW LEDGER ENTRY ENDPOINT ───
  @Post('ledger-entries')
  async addLedgerEntry(@Body() payload: any) {
    return this.distributionService.addLedgerEntry(payload);
  }
}
