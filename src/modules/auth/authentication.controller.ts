import { Controller, Post, Get, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthenticationService } from './authentication.service';
import { SendOtpDto, VerifyOtpDto, RefreshTokenDto } from './dto/auth.dto';
import { ResponseFormatter } from 'src/common';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';

@Controller('api/auth')
export class AuthenticationController {
    constructor(private readonly authService: AuthenticationService) { }

    @Post('send-otp')
    @HttpCode(HttpStatus.OK)
    async sendOtp(@Body() dto: SendOtpDto) {
        const result = await this.authService.sendOtp(dto);
        return ResponseFormatter.success(result, 'OTP sent successfully');
    }

    @Post('verify-otp')
    @HttpCode(HttpStatus.OK)
    async verifyOtp(@Body() dto: VerifyOtpDto) {
        const result = await this.authService.verifyOtp(dto);
        return ResponseFormatter.success(result, 'Authentication successful');
    }

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    async refreshToken(@Body() dto: RefreshTokenDto) {
        const result = await this.authService.refreshAccessTokenForUser(
            dto.user_id,
            dto.refresh_token,
        );
        return ResponseFormatter.success(result, 'Token refreshed successfully');
    }

    @Post('logout')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async logout(@Request() req: any) {
        const result = await this.authService.logout(req.user.id);
        return ResponseFormatter.success(result, 'Logged out successfully');
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    @HttpCode(HttpStatus.OK)
    async getMe(@Request() req: any) {
        const result = await this.authService.getMe(req.user.id);
        return ResponseFormatter.success(result, 'User profile retrieved successfully');
    }
}
