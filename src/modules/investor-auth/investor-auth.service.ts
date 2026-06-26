import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { AuthenticationRepository } from '../auth/authentication.repository'; // Reusing OTP logic
import { Investor } from 'src/entities/investor.entity';
import {
  SendInvestorOtpDto,
  LoginInvestorDto,
  VerifyInvestorOtpDto,
  ResetInvestorPasswordDto,
} from './dto/investor-auth.dto';

import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

@Injectable()
export class InvestorAuthService {
  private readonly logger = new Logger(InvestorAuthService.name);
  // OTP verification for forgot password
  private otpResetTokens = new Map<string, string>(); // mobile -> token (in-memory, for demo)

  constructor(
    private readonly authRepo: AuthenticationRepository,
    @InjectRepository(Investor)
    private readonly investorRepo: Repository<Investor>,
    private readonly jwtService: JwtService,
  ) {}

  async sendOtp(dto: SendInvestorOtpDto) {
    const { mobile } = dto;

    // Find investor by mobile
    const investor = await this.investorRepo.findOne({ where: { mobile } });
    if (!investor) {
      // Should we block non-existent investors?
      // "use investors table as master table" implies only existing investors can login.
      throw new NotFoundException('Investor not found');
    }

    // Generate OTP
    const otp = crypto.randomInt(1000, 9999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 mins

    await this.authRepo.createOtp(mobile, otp, expiresAt, 'INVESTOR');

    // TODO: Send SMS
    this.logger.log(`Investor OTP for ${mobile}: ${otp}`);

    return { message: 'OTP sent successfully' };
  }

  async login(dto: LoginInvestorDto) {
    const { identifier, password } = dto;

    const investor = await this.investorRepo.findOne({
      where: [{ username: identifier }, { email: identifier }],
      relations: ['company', 'company.details'],
    });

    if (!investor) {
      throw new UnauthorizedException('Invalid credentials');
    }

    console.log(identifier);

    if (!investor.password_hash) {
      throw new UnauthorizedException(
        'Please ask your distributor to generate credentials first',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      investor.password_hash,
    );
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate Token
    // Payload: { investor_id: uuid }
    const payload = {
      investor_id: investor.id,
      mobile: investor.mobile,
      username: investor.username,
      email: investor.email,
    };

    // Get logo from the relation we loaded
    const logo_base64 = investor.company?.details?.logo_base64 || null;
    const accessToken = this.jwtService.sign(payload);

    return {
      access_token: accessToken,
      investor: {
        id: investor.id,
        name: investor.name,
        mobile: investor.mobile,
        email: investor.email,
        logo_base64: logo_base64,
      },
    };
  }

  async verifyOtpForPasswordReset(dto: VerifyInvestorOtpDto) {
    const { mobile, otp } = dto;
    const otpLog = await this.authRepo.findLatestOtp(mobile, 'INVESTOR');
    if (
      !otpLog ||
      otpLog.otp_code !== otp ||
      otpLog.is_used ||
      new Date(otpLog.expires_at) < new Date()
    ) {
      throw new BadRequestException('Invalid or expired OTP');
    }
    await this.authRepo.markOtpAsUsed(otpLog.id);
    // Generate a short-lived token (in-memory for demo)
    const token = crypto.randomBytes(24).toString('hex');
    this.otpResetTokens.set(mobile, token);
    setTimeout(() => this.otpResetTokens.delete(mobile), 10 * 60 * 1000); // 10 min expiry
    return { otp_token: token };
  }

  async resetPasswordWithOtpToken(dto: ResetInvestorPasswordDto) {
    const { mobile, otp_token, new_password } = dto;
    const validToken = this.otpResetTokens.get(mobile);
    if (!validToken || validToken !== otp_token) {
      throw new BadRequestException('Invalid or expired OTP token');
    }
    const investor = await this.investorRepo.findOne({ where: { mobile } });
    if (!investor) {
      throw new NotFoundException('Investor not found');
    }
    investor.password_hash = await bcrypt.hash(new_password, 10);
    await this.investorRepo.save(investor);
    this.otpResetTokens.delete(mobile);
    return { message: 'Password reset successful' };
  }
}
