import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  Patch,
  Delete,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CompaniesService } from './companies.service';
import { ResponseFormatter } from 'src/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { CreateCompanyArnDto } from './dto/create-company-arn.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RoleGuard } from 'src/common/guards/role.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { UserRole } from 'src/entities/user-profile.entity';

@Controller('api/companies')
@UseGuards(JwtAuthGuard, RoleGuard)
export class CompaniesController {
  constructor(private readonly service: CompaniesService) {}

  @Get()
  @Roles(UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
  ) {
    const result = await this.service.findAll(page, limit);
    return ResponseFormatter.success(
      result,
      'Companies retrieved successfully',
    );
  }

  @Get(':id')
  @Roles(UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN, UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    const result = await this.service.findById(id);
    return ResponseFormatter.success(result, 'Company retrieved successfully');
  }

  @Post()
  @Roles(UserRole.FINIQ_ADMIN)
  @HttpCode(HttpStatus.OK) // Or CREATED (201)
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    const result = await this.service.create(createCompanyDto);
    return ResponseFormatter.success(result, 'Company created successfully');
  }

  @Post('users')
  @UseGuards(JwtAuthGuard, RoleGuard)
  @Roles(UserRole.COMPANY_ADMIN)
  @HttpCode(HttpStatus.OK)
  async createCompanyUser(@Request() req, @Body() dto: CreateCompanyUserDto) {
    const result = await this.service.createCompanyUser(req.user, dto);
    return ResponseFormatter.success(
      result,
      'Company user created successfully',
    );
  }

  @Post('arn')
  @Roles(UserRole.FINIQ_ADMIN)
  @HttpCode(HttpStatus.OK)
  async createArn(@Request() req, @Body() dto: CreateCompanyArnDto) {
    const result = await this.service.createArn(req.user, dto);
    return ResponseFormatter.success(
      'Company ARN created successfully',
    );
  }

  @Post(':companyId/logo')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file'))
  async uploadLogo(
    @Request() req,
    @Param('companyId') companyId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const result = await this.service.uploadLogo(req.user, companyId, file);
    return ResponseFormatter.success(result, 'Company logo uploaded successfully');
  }

  @Delete(':companyId/logo')
  @Roles(UserRole.COMPANY_ADMIN, UserRole.FINIQ_ADMIN, UserRole.TENANT_ADMIN)
  @HttpCode(HttpStatus.OK)
  async deleteLogo(@Request() req, @Param('companyId') companyId: string) {
    const result = await this.service.deleteLogo(req.user, companyId);
    return ResponseFormatter.success(result, 'Company logo deleted successfully');
  }

  @Get(':companyId/logo-url')
  @HttpCode(HttpStatus.OK)
  async getLogoUrl(@Request() req, @Param('companyId') companyId: string) {
    const result = await this.service.getLogoUrl(req.user, companyId);
    return ResponseFormatter.success(result, 'Company logo URL retrieved successfully');
  }
}
