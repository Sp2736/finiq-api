import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
  Query,
} from '@nestjs/common';
import { UserManagementService } from './user-management.service';
import { CreateUserDto, UpdateSubBrokerDto } from './dto/user-management.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { ResponseFormatter } from 'src/common';

@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, RoleGuard)
export class UserManagementController {
  constructor(private readonly service: UserManagementService) {}

  @Post()
  @Roles(UserRole.COMPANY_ADMIN)
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    if (!dto.company_id) {
      dto.company_id =
        req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
        req.user?.company_id;
    }
    const result = await this.service.createUser(dto);
    return ResponseFormatter.success(result, 'User created successfully');
  }

  @Get('all-users')
  @UseGuards(RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  async getAllUsersPaginated(
    @Req() req: any,
    @Query('page') page: string,
    @Query('limit') limit: string,
    @Query('search') search?: string,
  ) {
    const companyId =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id ||
      req.user?.company_id;
    const result = await this.service.getPaginatedUsers(
      companyId,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10,
      search,
    );
    return ResponseFormatter.success(result, 'Users fetched successfully');
  }

  @Get()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async getUsers(@Req() req: any) {
    const result = await this.service.getAllUsers(req.user);
    return ResponseFormatter.success(result, 'Users fetched successfully');
  }

  @Get('hierarchy')
  @Roles(UserRole.COMPANY_ADMIN)
  async getHierarchy(@Req() req: any) {
    const result = await this.service.getHierarchy(req.user);
    return ResponseFormatter.success(result, 'Hierarchy fetched successfully');
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  async getSubBroker(@Param('id') id: string) {
    const result = await this.service.getSubBrokerById(id);
    return ResponseFormatter.success(
      result,
      'Sub-broker details fetched successfully',
    );
  }

  @Put(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  async updateSubBroker(
    @Param('id') id: string,
    @Body() dto: UpdateSubBrokerDto,
  ) {
    const result = await this.service.updateSubBroker(id, dto);
    return ResponseFormatter.success(result, 'Sub-broker updated successfully');
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN)
  async deleteSubBroker(@Param('id') id: string) {
    const result = await this.service.deleteSubBroker(id);
    return ResponseFormatter.success(result, 'Sub-broker deleted successfully');
  }
}