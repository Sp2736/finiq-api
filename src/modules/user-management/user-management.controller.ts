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
import {
  CreateUserDto,
  CreateUserRole,
  UpdateSubBrokerDto,
} from './dto/user-management.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';
import { ResponseFormatter } from 'src/common';
import { HierarchyAccessService } from 'src/common/services/hierarchy-access.service';

@Controller('api/admin/users')
@UseGuards(JwtAuthGuard, RoleGuard)
export class UserManagementController {
  constructor(
    private readonly service: UserManagementService,
    private readonly hierarchyAccess: HierarchyAccessService,
  ) {}

  @Post()
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async createUser(@Req() req: any, @Body() dto: CreateUserDto) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    if (!dto.company_id) {
      dto.company_id = access.companyId || undefined;
    }

    if (
      dto.role === CreateUserRole.SUB_BROKER ||
      dto.role === CreateUserRole.INVESTOR
    ) {
      if (dto.parent_id) {
        this.hierarchyAccess.assertSubBrokerAllowed(access, dto.parent_id);
      } else if (access.allowedSubBrokerIds !== null) {
        throw new (await import('@nestjs/common')).ForbiddenException(
          'You must provide a parent_id within your hierarchy',
        );
      }
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
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    const result = await this.service.getAllUsers(access);
    return ResponseFormatter.success(result, 'Users fetched successfully');
  }

  @Get('hierarchy')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async getHierarchy(@Req() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    const result = await this.service.getHierarchy(access);
    return ResponseFormatter.success(result, 'Hierarchy fetched successfully');
  }

  @Get(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async getSubBroker(@Param('id') id: string, @Req() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    this.hierarchyAccess.assertSubBrokerAllowed(access, id);
    const result = await this.service.getSubBrokerById(id);
    return ResponseFormatter.success(
      result,
      'Sub-broker details fetched successfully',
    );
  }

  @Put(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async updateSubBroker(
    @Param('id') id: string,
    @Body() dto: UpdateSubBrokerDto,
    @Req() req: any,
  ) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    this.hierarchyAccess.assertSubBrokerAllowed(access, id);
    if (dto.parent_id) {
      this.hierarchyAccess.assertSubBrokerAllowed(access, dto.parent_id);
    } else if (
      access.allowedSubBrokerIds !== null &&
      dto.parent_id !== undefined
    ) {
      throw new (await import('@nestjs/common')).ForbiddenException(
        'You cannot remove the parent of a broker',
      );
    }
    const result = await this.service.updateSubBroker(id, dto);
    return ResponseFormatter.success(result, 'Sub-broker updated successfully');
  }

  @Delete(':id')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.BROKER, UserRole.SUB_BROKER)
  async deleteSubBroker(@Param('id') id: string, @Req() req: any) {
    const access = await this.hierarchyAccess.resolveAccess(req.user);
    this.hierarchyAccess.assertSubBrokerAllowed(access, id);
    const result = await this.service.deleteSubBroker(id);
    return ResponseFormatter.success(result, 'Sub-broker deleted successfully');
  }
}
