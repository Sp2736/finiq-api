import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { InvestorAuthService } from './investor-auth.service';
import { SendInvestorOtpDto, LoginInvestorDto, ForgotInvestorPasswordDto, VerifyInvestorOtpDto, ResetInvestorPasswordDto } from './dto/investor-auth.dto';

import { ResponseFormatter } from 'src/common';

@Controller('api/investor-auth')
export class InvestorAuthController {
    constructor(private readonly service: InvestorAuthService) { }

    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    async sendOtp(@Body() dto: SendInvestorOtpDto) {
        const result = await this.service.sendOtp(dto);
        return ResponseFormatter.success(result, 'OTP sent successfully');
    }

    @Post('login')
    @HttpCode(HttpStatus.OK)
    async login(@Body() dto: LoginInvestorDto) {
        const result = await this.service.login(dto);
        return ResponseFormatter.success(result, 'Login successful');
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req) {
        // Here we would typically invalidate the token if we had a token blacklist/redis layer.
        // For stateless JWTs, the client simply clears the token locally.
        return ResponseFormatter.success(null, 'Logged out successfully');
    }

    @Post('forgot-password/send-otp')
    @HttpCode(HttpStatus.OK)
    async forgotPasswordSendOtp(@Body() dto: ForgotInvestorPasswordDto) {
        const result = await this.service.sendOtp(dto); // Reuse sendOtp logic
        return ResponseFormatter.success(result, 'OTP sent for password reset');
    }

    @Post('forgot-password/verify-otp')
    @HttpCode(HttpStatus.OK)
    async forgotPasswordVerifyOtp(@Body() dto: VerifyInvestorOtpDto) {
        const result = await this.service.verifyOtpForPasswordReset(dto);
        return ResponseFormatter.success(result, 'OTP verified, use token to reset password');
    }

    @Post('forgot-password/reset')
    @HttpCode(HttpStatus.OK)
    async resetPassword(@Body() dto: ResetInvestorPasswordDto) {
        const result = await this.service.resetPasswordWithOtpToken(dto);
        return ResponseFormatter.success(result, 'Password reset successful');
    }
}
