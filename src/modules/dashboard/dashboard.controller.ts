import { Controller, Get, Query, HttpCode, HttpStatus, UseGuards, Request, Logger } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { ResponseFormatter } from 'src/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';

@Controller('api/dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
    private readonly logger = new Logger(DashboardController.name);

    constructor(private readonly dashboardService: DashboardService) { }

    // ────────────── Admin Endpoints ──────────────

    @Get('admin/summary')
    @UseGuards(RoleGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
    @HttpCode(HttpStatus.OK)
    async getAdminSummary(@Request() req: any) {
        const companyId = this.getCompanyId(req.user);
        this.logger.debug(`Admin summary requested for company: ${companyId}`);
        const result = await this.dashboardService.getAdminSummary(companyId);
        return ResponseFormatter.success(result, 'Admin dashboard summary retrieved');
    }

    @Get('admin/aum-trend')
    @UseGuards(RoleGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
    @HttpCode(HttpStatus.OK)
    async getAumTrend(@Request() req: any, @Query('months') months?: number) {
        const companyId = this.getCompanyId(req.user);
        const result = await this.dashboardService.getAumTrend(companyId, months || 12);
        return ResponseFormatter.success(result, 'AUM trend data retrieved');
    }

    @Get('admin/portfolio-distribution')
    @UseGuards(RoleGuard)
    @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
    @HttpCode(HttpStatus.OK)
    async getPortfolioDistribution(@Request() req: any) {
        const companyId = this.getCompanyId(req.user);
        const result = await this.dashboardService.getPortfolioDistribution(companyId);
        return ResponseFormatter.success(result, 'Portfolio distribution retrieved');
    }

    // ────────────── Broker Endpoints ──────────────

    @Get('broker/summary')
    @UseGuards(RoleGuard)
    @Roles(UserRole.BROKER, UserRole.SUB_BROKER, UserRole.COMPANY_USER)
    @HttpCode(HttpStatus.OK)
    async getBrokerSummary(@Request() req: any) {
        const { userProfileId, companyId } = this.getBrokerContext(req.user);
        const result = await this.dashboardService.getBrokerSummary(userProfileId, companyId);
        return ResponseFormatter.success(result, 'Broker dashboard summary retrieved');
    }

    @Get('broker/client-stats')
    @UseGuards(RoleGuard)
    @Roles(UserRole.BROKER, UserRole.SUB_BROKER, UserRole.COMPANY_USER)
    @HttpCode(HttpStatus.OK)
    async getBrokerClientStats(@Request() req: any) {
        const { userProfileId, companyId } = this.getBrokerContext(req.user);
        const result = await this.dashboardService.getBrokerClientStats(userProfileId, companyId);
        return ResponseFormatter.success(result, 'Broker client stats retrieved');
    }

    @Get('broker/performance')
    @UseGuards(RoleGuard)
    @Roles(UserRole.BROKER, UserRole.SUB_BROKER, UserRole.COMPANY_USER)
    @HttpCode(HttpStatus.OK)
    async getBrokerPerformance(@Request() req: any) {
        const { userProfileId, companyId } = this.getBrokerContext(req.user);
        const result = await this.dashboardService.getBrokerPerformance(userProfileId, companyId);
        return ResponseFormatter.success(result, 'Broker performance data retrieved');
    }

    // ────────────── Helpers ──────────────

    private getCompanyId(user: any): string {
        if (!user?.roles?.length) {
            throw new Error('User has no roles');
        }
        return user.roles[0].company_id;
    }

    private getBrokerContext(user: any): { userProfileId: string; companyId: string } {
        if (!user?.roles?.length) {
            throw new Error('User has no roles');
        }
        const brokerRole = user.roles.find((r: any) =>
            [UserRole.BROKER, UserRole.SUB_BROKER, UserRole.COMPANY_USER].includes(r.role)
        ) || user.roles[0];

        return {
            userProfileId: user.id, // Will need user_profile_id from JWT or lookup
            companyId: brokerRole.company_id,
        };
    }
}
