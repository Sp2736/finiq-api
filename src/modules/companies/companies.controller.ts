import { Controller, Get, Post, Body, Param, Query, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
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
export class CompaniesController {
    constructor(private readonly service: CompaniesService) { }

    @Get()
    @HttpCode(HttpStatus.OK)
    async findAll(
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 10,
    ) {
        const result = await this.service.findAll(page, limit);
        return ResponseFormatter.success(result, 'Companies retrieved successfully');
    }

    @Get(':id')
    @HttpCode(HttpStatus.OK)
    async findById(@Param('id') id: string) {
        const result = await this.service.findById(id);
        return ResponseFormatter.success(result, 'Company retrieved successfully');
    }

    @Post()
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
        return ResponseFormatter.success(result, 'Company user created successfully');
    }

    @Post('arn')
    @UseGuards(JwtAuthGuard, RoleGuard)
    @Roles(UserRole.COMPANY_ADMIN)
    @HttpCode(HttpStatus.OK)
    async createArn(@Request() req, @Body() dto: CreateCompanyArnDto) {
        const result = await this.service.createArn(req.user, dto);
        return ResponseFormatter.success(result, 'Company ARN created successfully');
    }
}
