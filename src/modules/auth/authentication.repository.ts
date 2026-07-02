import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OtpLog } from 'src/entities/otp-log.entity';
import { User, UserStatus } from 'src/entities/user.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import * as crypto from 'crypto';
import { CompanyDetail } from 'src/entities/company-detail.entity';

import { SubBroker } from 'src/entities/sub-broker.entity';

@Injectable()
export class AuthenticationRepository {
  private readonly logger = new Logger(AuthenticationRepository.name);

  constructor(
    @InjectRepository(OtpLog)
    private readonly otpLogRepo: Repository<OtpLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(UserProfile)
    private readonly userProfileRepo: Repository<UserProfile>,
    @InjectRepository(CompanyDetail)
    private readonly companyDetailRepo: Repository<CompanyDetail>,
    @InjectRepository(SubBroker)
    private readonly subBrokerRepo: Repository<SubBroker>,
  ) {}

  async findCompanyDetail(companyId: string): Promise<CompanyDetail | null> {
    if (!companyId) return null;
    return await this.companyDetailRepo.findOne({
      where: { company_id: companyId },
      relations: ['company'],
    });
  }

  async createOtp(
    phoneNumber: string,
    otpCode: string,
    expiresAt: Date,
    scope: 'USER' | 'INVESTOR' = 'USER',
  ): Promise<OtpLog> {
    const otpLog = this.otpLogRepo.create({
      phone_number: phoneNumber,
      otp_code: otpCode,
      expires_at: expiresAt,
      is_used: false,
      scope,
    });
    return this.otpLogRepo.save(otpLog);
  }

  async findLatestOtp(
    phoneNumber: string,
    scope: 'USER' | 'INVESTOR' = 'USER',
  ): Promise<OtpLog | null> {
    return this.otpLogRepo.findOne({
      where: { phone_number: phoneNumber, is_used: false, scope },
      order: { created_at: 'DESC' },
    });
  }

  async markOtpAsUsed(id: string): Promise<void> {
    await this.otpLogRepo.update(id, { is_used: true });
  }

  async findUserByPhone(phoneNumber: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { phone_number: phoneNumber } });
  }

  async findUserById(userId: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id: userId } });
  }

  async findUserByIdWithRefreshToken(userId: string): Promise<User | null> {
    return this.userRepo
      .createQueryBuilder('user')
      .addSelect('user.refresh_token')
      .where('user.id = :id', { id: userId })
      .getOne();
  }

  async findSubBrokerByUserId(userId: string): Promise<SubBroker | null> {
    return this.subBrokerRepo.findOne({ where: { user_id: userId } });
  }

  async createUser(phoneNumber: string): Promise<User> {
    const user = this.userRepo.create({
      phone_number: phoneNumber,
      status: UserStatus.ACTIVE,
      is_verified: true,
    });
    return this.userRepo.save(user);
  }

  async findUserProfiles(userId: string): Promise<UserProfile[]> {
    return this.userProfileRepo.find({
      where: { user_id: userId, is_active: true },
      relations: ['company'],
    });
  }

  async saveRefreshToken(
    userId: string,
    refreshToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    await this.userRepo.update(userId, {
      refresh_token: hashedToken,
      refresh_token_expires_at: expiresAt,
      last_login: new Date(),
    });
  }

  async clearRefreshToken(userId: string): Promise<void> {
    await this.userRepo.update(userId, {
      refresh_token: null as any,
      refresh_token_expires_at: null as any,
    });
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.userRepo.update(userId, { last_login: new Date() });
  }
}
