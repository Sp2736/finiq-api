import { Controller, Get, Post, HttpCode, HttpStatus, UseGuards, Request, Query, Body, BadRequestException, ForbiddenException } from '@nestjs/common';
import { HoldingsCacheService } from './holdings-cache.service';
import { ResponseFormatter, PaginationHelper } from '../../common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RoleGuard } from '../../common/guards/role.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../entities/user-profile.entity';

@Controller('api/holdings-cache')
@UseGuards(JwtAuthGuard)
export class HoldingsCacheController {
  constructor(private readonly holdingsCacheService: HoldingsCacheService) { }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshCache() {
    // We run this in the background to avoid timeout
    this.holdingsCacheService.refreshAllHoldings().catch(err => {
      console.error('Manual cache refresh failed:', err);
    });

    return ResponseFormatter.success(null, 'Holdings cache refresh triggered in background');
  }

  @Get('company-summary')
  @UseGuards(RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getCompanySummary(@Request() req: any) {
    const companyId = this.getCompanyId(req.user);
    const result = await this.holdingsCacheService.getSummaryByCompany(companyId);
    return ResponseFormatter.success(result, 'Company holdings summary retrieved successfully');
  }

  @Get('top-contributors')
  @UseGuards(RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getTopContributors(@Request() req: any) {
    const companyId = this.getCompanyId(req.user);
    const result = await this.holdingsCacheService.getTopContributingClients(companyId);
    return ResponseFormatter.success(result, 'Top contributing clients retrieved successfully');
  }

  @Get('investors')
  @UseGuards(RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvestorsList(
    @Request() req: any,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('search') search?: string,
  ) {
    const companyId = this.getCompanyId(req.user);
    const { page: pageNum, limit: limitNum } = PaginationHelper.getPaginationParams(page, limit);
    const { data, total } = await this.holdingsCacheService.getCompanyInvestorsList(companyId, pageNum ?? 1, limitNum ?? 10, search);
    return ResponseFormatter.paginated(data, total, pageNum ?? 1, limitNum ?? 10);
  }

  @Post('investor-holdings')
  @UseGuards(RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async getInvestorHoldings(@Request() req: any, @Body('investor_id') investorId: string) {
    if (!investorId) {
      throw new BadRequestException('investor_id is required in the request body');
    }
    const companyId = this.getCompanyId(req.user);
    try {
      const result = await this.holdingsCacheService.getInvestorHoldings(companyId, investorId);
      return ResponseFormatter.success(result, 'Investor holdings retrieved successfully');
    } catch (error) {
      throw new ForbiddenException(error.message);
    }
  }

  private getCompanyId(user: any): string {
    if (!user?.roles?.length) {
      throw new Error('User has no roles');
    }
    // Find the first role that has an associated company_id
    const roleWithCompany = user.roles.find((r: any) => r.company_id);
    if (!roleWithCompany) {
      throw new Error('User has no role associated with a company');
    }
    return roleWithCompany.company_id;
  }
}
