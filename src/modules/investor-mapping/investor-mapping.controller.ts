import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import { InvestorMappingService } from './investor-mapping.service';
import {
  AssignInvestorsDto,
  UnassignInvestorsDto,
} from './dto/investor-mapping.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { ResponseFormatter } from 'src/common';

const MAPPING_ROLES = [
  UserRole.COMPANY_ADMIN,
  UserRole.BROKER,
  UserRole.SUB_BROKER,
];

@Controller('api/companies/investor-mapping')
@UseGuards(JwtAuthGuard, RoleGuard)
export class InvestorMappingController {
  constructor(private readonly service: InvestorMappingService) {}

  @Get('brokers')
  @Roles(...MAPPING_ROLES)
  async getAssignableBrokers(@Request() req) {
    const result = await this.service.getAssignableBrokers(req.user);
    return ResponseFormatter.success(result, 'Brokers fetched successfully');
  }

  @Get('investors')
  @Roles(...MAPPING_ROLES)
  async getInvestors(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: 'all' | 'mapped' | 'unmapped',
    @Query('sub_broker_id') sub_broker_id?: string,
  ) {
    const result = await this.service.getInvestors(req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      search,
      status: status || 'all',
      sub_broker_id,
    });
    return ResponseFormatter.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Get('history')
  @Roles(...MAPPING_ROLES)
  async getHistory(
    @Request() req,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('sub_broker_id') sub_broker_id?: string,
  ) {
    const result = await this.service.getHistory(req.user, {
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20,
      sub_broker_id,
    });
    return ResponseFormatter.paginated(
      result.data,
      result.total,
      result.page,
      result.limit,
    );
  }

  @Post('assign')
  @Roles(...MAPPING_ROLES)
  @HttpCode(HttpStatus.OK)
  async assign(@Request() req, @Body() dto: AssignInvestorsDto) {
    const result = await this.service.assignInvestors(req.user, dto);
    return ResponseFormatter.success(result, 'Investors assigned successfully');
  }

  @Post('unassign')
  @Roles(...MAPPING_ROLES)
  @HttpCode(HttpStatus.OK)
  async unassign(@Request() req, @Body() dto: UnassignInvestorsDto) {
    const result = await this.service.unassignInvestors(req.user, dto);
    return ResponseFormatter.success(
      result,
      'Investors unassigned successfully',
    );
  }
}
