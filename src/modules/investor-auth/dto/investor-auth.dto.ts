import { IsNotEmpty, IsString, Length } from 'class-validator';

export class SendInvestorOtpDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;
}

export class LoginInvestorDto {
  @IsString()
  @IsNotEmpty()
  identifier: string; // can be username or email

  @IsString()
  @IsNotEmpty()
  password: string;
}

export class ForgotInvestorPasswordDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;
}

export class VerifyInvestorOtpDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}

export class ResetInvestorPasswordDto {
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @IsString()
  @IsNotEmpty()
  otp_token: string;

  @IsString()
  @IsNotEmpty()
  new_password: string;
}

export interface InvestorLoginResponse {
  access_token: string;
  investor: {
    id: string;
    name: string;
    mobile: string;
    email: string;
    logo_base64: string | null; // This matches the field we are injecting in the service
  };
}
