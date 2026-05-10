import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsNumber, IsArray } from 'class-validator';

export class CreateCompanyArnDto {
    @IsString()
    @IsNotEmpty()
    arn_no: string;

    @IsString()
    @IsOptional()
    euin?: string;

    @IsString()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    email_host?: string;

    @IsNumber()
    @IsOptional()
    email_port?: number;

    @IsString()
    @IsOptional()
    email_user?: string;

    @IsString()
    @IsOptional()
    email_password?: string;

    @IsBoolean()
    @IsOptional()
    email_use_ssl?: boolean;

    @IsString()
    @IsOptional()
    cams_zip_password?: string;

    @IsArray()
    @IsOptional()
    credentials?: {
        source: string;
        mailback_pass?: string | null;
        camsonline_pass?: string | null;
        fundsnet_pass?: string | null;
    }[];
}
