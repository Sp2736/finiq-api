import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { BaseService } from 'src/common/base/base.service';
import { Company } from 'src/entities/company.entity';
import { CompanyDetail } from 'src/entities/company-detail.entity';
import { CompanyArn } from 'src/entities/company-arn.entity';
import { User, UserStatus } from 'src/entities/user.entity';
import { UserProfile, UserRole } from 'src/entities/user-profile.entity'; // Typo in filename 'enity' is from user request, respecting it
import { Tenant } from 'src/entities/tenant.entity';
import { SubBroker } from 'src/entities/sub-broker.entity';
import { CompaniesRepository } from './companies.repository';
import { PaginationHelper } from 'src/common';
import { CreateCompanyDto } from './dto/create-company.dto';
import { CreateCompanyUserDto } from './dto/create-company-user.dto';
import { CreateCompanyArnDto } from './dto/create-company-arn.dto';

@Injectable()
export class CompaniesService extends BaseService<Company, any, any> {
  protected readonly logger = new Logger(CompaniesService.name);

  constructor(
    private readonly repository: CompaniesRepository,
    private readonly dataSource: DataSource,
    @InjectRepository(Tenant)
    private readonly tenantRepo: Repository<Tenant>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
  ) {
    super();
  }

  async findAll(page: number = 1, limit: number = 10) {
    try {
      const pagination = PaginationHelper.getPaginationParams(page, limit);
      const [data, total] = await this.repository.findAll(pagination);
      return this.formatPaginatedResponse(data, total, pagination);
    } catch (error) {
      await this.handleError(error, 'findAll');
    }
  }

  async findById(id: string) {
    try {
      return await this.repository.findById(id);
    } catch (error) {
      await this.handleError(error, 'findById');
    }
  }

  async create(createCompanyDto: CreateCompanyDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Resolve Tenant
      let tenantId = createCompanyDto.tenant_id;
      if (!tenantId) {
        const defaultTenant = await this.tenantRepo.findOne({
          where: { is_active: true },
          order: { created_at: 'ASC' },
        });
        if (!defaultTenant) {
          throw new BadRequestException(
            'No active tenant found to associate with the company.',
          );
        }
        tenantId = defaultTenant.id;
      }

      // 2. Create Company
      const company = new Company();
      company.name = createCompanyDto.name;
      company.email = createCompanyDto.email;
      company.tenant_id = tenantId;
      company.is_active = true;

      // 3. Create Company Details
      if (createCompanyDto.details) {
        const details = new CompanyDetail();
        Object.assign(details, createCompanyDto.details);
        company.details = details;
      }

      // 4. Create Company ARNs
      if (createCompanyDto.arns && createCompanyDto.arns.length > 0) {
        company.arns = createCompanyDto.arns.map((arnDto) => {
          const arn = new CompanyArn();
          arn.arnNo = arnDto.arn_no;
          arn.euin = arnDto.euin ?? '';
          arn.email = arnDto.email ?? '';
          arn.phone = arnDto.phone ?? '';
          arn.email_host = arnDto.email_host ?? '';
          arn.email_port = arnDto.email_port ?? 0;
          arn.email_user = arnDto.email_user ?? '';
          arn.email_password = arnDto.email_password ?? '';
          arn.email_use_ssl = arnDto.email_use_ssl ?? true;
          arn.cams_zip_password = arnDto.cams_zip_password ?? '';
          arn.credentials = arnDto.credentials ?? [];
          arn.is_active = true;
          return arn;
        });
      }

      // Save Company (cascades details and arns)
      const savedCompany = await queryRunner.manager.save(Company, company);

      // Automatically Generate SubBrokers for freshly mapped ARNs
      if (savedCompany.arns && savedCompany.arns.length > 0) {
        for (const arn of savedCompany.arns) {
          const subBroker = new SubBroker();
          subBroker.name = savedCompany.name;
          subBroker.arn_id = arn.arnNo ?? '';
          subBroker.company_id = savedCompany.id;
          await queryRunner.manager.save(SubBroker, subBroker);
        }
      }

      // 5. Create or Find User
      let user = await this.userRepo.findOne({
        where: { phone_number: createCompanyDto.phone_number },
      });
      if (!user) {
        user = new User();
        user.phone_number = createCompanyDto.phone_number ?? '';
        user.status = UserStatus.PENDING;
        user.is_verified = false;
        user = await queryRunner.manager.save(User, user);
      }

      // 6. Create User Profile (Link to Company)
      // Check if profile exists for this company role - skipping check, assuming new assignment
      const userProfile = new UserProfile();
      userProfile.user_id = user.id;
      userProfile.company_id = savedCompany.id;
      userProfile.tenant_id = tenantId;
      userProfile.role = UserRole.COMPANY_ADMIN;
      userProfile.is_active = true;

      await queryRunner.manager.save(UserProfile, userProfile);

      await queryRunner.commitTransaction();

      return savedCompany;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error creating company: ${error.message}`,
        error.stack,
      );
      throw error; // Rethrow to be handled by global filter or controller
    } finally {
      await queryRunner.release();
    }
  }
  async createCompanyUser(userPayload: any, dto: CreateCompanyUserDto) {
    // Extract Admin's Company Context
    // userPayload.roles array contains { role, company_id, tenant_id }
    const adminRole = userPayload.roles.find(
      (r) => r.role === UserRole.COMPANY_ADMIN,
    );

    if (!adminRole || !adminRole.company_id) {
      throw new BadRequestException(
        'User is not a company admin or missing company context',
      );
    }

    const companyId = adminRole.company_id;
    const tenantId = adminRole.tenant_id;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Find or Create User
      let user = await this.userRepo.findOne({
        where: { phone_number: dto.phone_number },
      });

      if (!user) {
        user = new User();
        user.phone_number = dto.phone_number;
        user.status = UserStatus.PENDING;
        user.is_verified = false;
        user = await queryRunner.manager.save(User, user);
      }

      // 2. Check if Profile Exists in this Company
      const existingProfile = await this.userProfileRepo.findOne({
        where: {
          user_id: user.id,
          company_id: companyId,
        },
      });

      if (existingProfile) {
        // Already part of this company
        throw new BadRequestException(
          'User is already a member of this company',
        );
      }

      // 3. Create User Profile
      const userProfile = new UserProfile();
      userProfile.user_id = user.id;
      userProfile.company_id = companyId;
      userProfile.tenant_id = tenantId;
      userProfile.role = UserRole.COMPANY_USER;
      userProfile.is_active = true;
      userProfile.first_name = dto.first_name ?? '';
      userProfile.last_name = dto.last_name ?? '';
      userProfile.email = dto.email ?? '';

      await queryRunner.manager.save(UserProfile, userProfile);

      await queryRunner.commitTransaction();

      return {
        message: 'Company user created successfully',
        user: {
          id: user.id,
          phone_number: user.phone_number,
          profile_id: userProfile.id,
        },
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error creating company user: ${error.message}`,
        error.stack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  async createArn(
    userPayload: any,
    dto: CreateCompanyArnDto & { company_id?: string },
  ) {
    const adminRole = userPayload.roles.find((r: any) =>
      [
        UserRole.COMPANY_ADMIN,
        UserRole.FINIQ_ADMIN,
        UserRole.TENANT_ADMIN,
      ].includes(r.role),
    );

    if (!adminRole) {
      throw new BadRequestException('User is not authorized');
    }

    const companyId = dto.company_id || adminRole.company_id;
    if (!companyId) {
      throw new BadRequestException('Company context is required');
    }

    const company = await this.dataSource.manager.findOne(Company, {
      where: { id: companyId },
    });
    if (!company) {
      throw new BadRequestException('Company not found');
    }

    const arn = new CompanyArn();
    arn.company_id = companyId;
    arn.arnNo = dto.arn_no;
    arn.euin = dto.euin ?? '';
    arn.email = dto.email ?? '';
    arn.phone = dto.phone_number ?? '';
    arn.email_host = dto.email_host ?? '';
    arn.email_port = dto.email_port ?? 0;
    arn.email_user = dto.email_user ?? '';
    arn.email_password = dto.email_password ?? '';
    arn.email_use_ssl = dto.email_use_ssl ?? true;
    arn.cams_zip_password = dto.cams_zip_password ?? '';
    arn.credentials = dto.credentials ?? [];
    arn.is_active = true;

    return await this.dataSource.manager.transaction(async (manager) => {
      const savedArn = await manager.save(CompanyArn, arn);

      let userId: string | null = null;
      if (dto.phone_number) {
        // Create User and Profile for the distributor
        let user = await manager.findOne(User, {
          where: { phone_number: dto.phone_number },
        });
        if (!user) {
          user = manager.create(User, {
            phone_number: dto.phone_number,
            status: UserStatus.ACTIVE,
            is_verified: true,
            company_id: companyId,
          });
          user = await manager.save(User, user);
        }
        userId = user.id;

        // Check if profile exists
        const existingProfile = await manager.findOne(UserProfile, {
          where: { user_id: user.id, company_id: companyId },
        });

        if (!existingProfile) {
          const nameParts = (dto.distributor_name || company.name)
            .trim()
            .split(' ');
          const firstName = nameParts[0];
          const lastName =
            nameParts.length > 1 ? nameParts.slice(1).join(' ') : '';

          const profile = manager.create(UserProfile, {
            user_id: user.id,
            company_id: companyId,
            tenant_id: company.tenant_id,
            role: UserRole.BROKER, // Root ARNs are assigned the BROKER role
            is_active: true,
            first_name: firstName,
            last_name: lastName,
            email: dto.email,
          });
          await manager.save(UserProfile, profile);
        }
      }

      const subBroker = new SubBroker();
      subBroker.name = dto.distributor_name || company.name;
      subBroker.arn_id = savedArn.arnNo ?? '';
      subBroker.company_id = company.id;
      subBroker.email = dto.email ?? '';
      if (userId) {
        subBroker.user_id = userId;
      }

      await manager.save(SubBroker, subBroker);

      return savedArn;
    });
  }
}
