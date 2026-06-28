import {
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthenticationRepository } from './authentication.repository';
import { SendOtpDto, VerifyOtpDto } from './dto/auth.dto';
import { UserMapper } from '../../common/utils/user.mapper';
import {
  ApiErrorCode,
  ErrorMessages,
} from '../../common/constants/error-codes';
import { User } from 'src/entities/user.entity';
import { UserProfile } from 'src/entities/user-profile.entity';
import * as crypto from 'crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CompanyDetail } from 'src/entities/company-detail.entity';

@Injectable()
export class AuthenticationService {
  private readonly logger = new Logger(AuthenticationService.name);

  constructor(
    private readonly repository: AuthenticationRepository,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async sendOtp(dto: SendOtpDto) {
    const { phone_number } = dto;
    const user = await this.repository.findUserByPhone(phone_number);

    if (!user) {
      throw new NotFoundException(ErrorMessages[ApiErrorCode.USER_NOT_FOUND]);
    }

    const otpLength = this.configService.get<number>('OTP_LENGTH') || 4;
    const otpExpiryMinutes =
      this.configService.get<number>('OTP_EXPIRATION_MINUTES') || 5;

    // Generate OTP
    const otp = crypto
      .randomInt(Math.pow(10, otpLength - 1), Math.pow(10, otpLength) - 1)
      .toString();
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    await this.repository.createOtp(phone_number, otp, expiresAt, 'USER');

    // TODO: Integrate SMS Provider here.
    this.logger.log(`OTP for ${phone_number}: ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const { phone_number, otp_code } = dto;

    // Fetch OTP and user in parallel — no dependency between them
    const [otpRecord, user] = await Promise.all([
      this.repository.findLatestOtp(phone_number, 'USER'),
      this.repository.findUserByPhone(phone_number),
    ]);

    if (!otpRecord) {
      throw new BadRequestException(ErrorMessages[ApiErrorCode.OTP_INVALID]);
    }

    if (otpRecord.is_used) {
      throw new BadRequestException(
        ErrorMessages[ApiErrorCode.OTP_ALREADY_USED],
      );
    }

    if (otpRecord.otp_code !== otp_code) {
      throw new BadRequestException(ErrorMessages[ApiErrorCode.OTP_INVALID]);
    }

    if (otpRecord.expires_at < new Date()) {
      throw new BadRequestException(ErrorMessages[ApiErrorCode.OTP_EXPIRED]);
    }

    if (!user) {
      throw new UnauthorizedException(
        ErrorMessages[ApiErrorCode.USER_NOT_FOUND],
      );
    }

    const [profiles] = await Promise.all([
      this.repository.findUserProfiles(user.id),
      this.repository.markOtpAsUsed(otpRecord.id),
    ]);
    return await this.generateAuthResponse(user, profiles);
  }

  async refreshAccessTokenForUser(userId: string, refreshToken: string) {
    if (!refreshToken || !userId) {
      throw new UnauthorizedException('Refresh token and user ID required');
    }

    const user = await this.repository.findUserByIdWithRefreshToken(userId);
    if (!user) {
      throw new UnauthorizedException(
        ErrorMessages[ApiErrorCode.USER_NOT_FOUND],
      );
    }

    // Verify refresh token
    const hashedToken = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    if (user.refresh_token !== hashedToken) {
      // Token mismatch - possible token theft, clear all tokens
      await this.repository.clearRefreshToken(userId);
      throw new UnauthorizedException(
        'Invalid refresh token - session invalidated',
      );
    }

    // Check if refresh token expired
    if (
      user.refresh_token_expires_at &&
      user.refresh_token_expires_at < new Date()
    ) {
      await this.repository.clearRefreshToken(userId);
      throw new UnauthorizedException('Refresh token expired');
    }

    const profiles = await this.repository.findUserProfiles(user.id);
    return await this.generateAuthResponse(user, profiles);
  }

  async logout(userId: string) {
    await this.repository.clearRefreshToken(userId);
    return { message: 'Logged out successfully' };
  }

  async getMe(userId: string) {
    const user = await this.repository.findUserById(userId);
    if (!user) {
      throw new NotFoundException(ErrorMessages[ApiErrorCode.USER_NOT_FOUND]);
    }

    const profiles = await this.repository.findUserProfiles(user.id);

    return {
      id: user.id,
      phone_number: user.phone_number,
      status: user.status,
      last_login: user.last_login,
      roles: UserMapper.mapRoles(profiles),
    };
  }

  // ──────────────────────── PRIVATE HELPERS ────────────────────────

  /**
   * Common method to generate JWT and Refresh Token response
   */
  private async generateAuthResponse(user: User, profiles: UserProfile[]) {
    const roles = UserMapper.mapRoles(profiles);

    const payload = {
      sub: user.id,
      phone_number: user.phone_number,
      roles: roles,
      company_id: user.company_id,
    };

    const accessTokenExpiry =
      this.configService.get<string>('JWT_ACCESS_TOKEN_EXPIRATION') || '24h';
    const refreshExpiryDays =
      this.configService.get<number>('JWT_REFRESH_TOKEN_EXPIRATION_DAYS') || 7;

    // Generate tokens
    const access_token = this.jwtService.sign(payload as any, {
      expiresIn: accessTokenExpiry as any,
    });
    const refresh_token = crypto.randomBytes(64).toString('hex');
    const refreshExpiresAt = new Date(
      Date.now() + refreshExpiryDays * 24 * 60 * 60 * 1000,
    );

    // fix: Fetch company details (assuming repository has access to company_id)
    // const companyDetail = await this.repository.findCompanyDetail(
    //   user.company_id,
    // );

    // Use company_id from the user's profile (from user_profiles table) — most reliable source.
    // Falls back to user.company_id (now a real DB column after entity fix).
    const companyIdForLogo =
      roles.find((r) => r.company_id)?.company_id ?? user.company_id ?? null;

    let logo_base64: string | null = null;
    if (companyIdForLogo) {
      try {
        const companyDetail = await this.repository.findCompanyDetail(companyIdForLogo);
        logo_base64 = companyDetail?.logo_base64 || null;
      } catch (err) {
        this.logger.warn(`Could not fetch company logo for ${companyIdForLogo}: ${err}`);
      }
    }

    await this.repository.saveRefreshToken(
      user.id,
      refresh_token,
      refreshExpiresAt,
    );

    return {
      access_token,
      refresh_token,
      user: {
        id: user.id,
        phone_number: user.phone_number,
        roles: roles,
        company_logo: logo_base64,
      },
    };
  }
}
