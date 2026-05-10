import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { InvestorMappingService } from './investor-mapping.service';
import { AssignInvestorsDto, UnassignInvestorsDto } from './dto/investor-mapping.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { ResponseFormatter } from 'src/common';

@Controller('api/companies/investor-mapping')
@UseGuards(JwtAuthGuard, RoleGuard)
export class InvestorMappingController {
    constructor(private readonly service: InvestorMappingService) { }

    @Post('assign')
    @Roles(UserRole.COMPANY_ADMIN)
    @HttpCode(HttpStatus.OK)
    async assign(@Request() req, @Body() dto: AssignInvestorsDto) {
        const result = await this.service.assignInvestors(req.user, dto);
        return ResponseFormatter.success(result, 'Investors assigned successfully');
    }

    @Post('unassign')
    @Roles(UserRole.COMPANY_ADMIN)
    @HttpCode(HttpStatus.OK)
    async unassign(@Request() req, @Body() dto: UnassignInvestorsDto) {
        const result = await this.service.unassignInvestors(req.user, dto);
        return ResponseFormatter.success(result, 'Investors unassigned successfully');
    }
}
