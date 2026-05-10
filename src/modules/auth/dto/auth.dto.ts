import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendOtpDto {
    @IsString()
    @IsNotEmpty()
    phone_number: string;
}

export class VerifyOtpDto {
    @IsString()
    @IsNotEmpty()
    phone_number: string;

    @IsString()
    @IsNotEmpty()
    @Length(4, 6)
    otp_code: string;
}

export class RefreshTokenDto {
    @IsString()
    @IsNotEmpty()
    user_id: string;

    @IsString()
    @IsNotEmpty()
    refresh_token: string;
}
