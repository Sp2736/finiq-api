import { Type } from 'class-transformer';
import {
    IsArray,
    IsBoolean,
    IsEmail,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    ValidateNested,
} from 'class-validator';

export class ArnCredentialDto {
    @IsString()
    @IsNotEmpty()
    source: string;

    @IsString()
    @IsOptional()
    mailback_pass?: string;

    @IsString()
    @IsOptional()
    camsonline_pass?: string;

    @IsString()
    @IsOptional()
    fundsnet_pass?: string;
}

export class CompanyArnDto {
    @IsString()
    @IsNotEmpty()
    arn_no: string;

    @IsString()
    @IsOptional()
    euin?: string;

    @IsEmail()
    @IsOptional()
    email?: string;

    @IsString()
    @IsOptional()
    phone?: string;

    @IsString()
    @IsOptional()
    email_host?: string;

    @IsInt()
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
    @ValidateNested({ each: true })
    @Type(() => ArnCredentialDto)
    @IsOptional()
    credentials?: ArnCredentialDto[];
}

export class CompanyDetailDto {
    @IsString()
    @IsOptional()
    registration_number?: string;

    @IsString()
    @IsOptional()
    gst_no?: string;

    @IsString()
    @IsOptional()
    address_line1?: string;

    @IsString()
    @IsOptional()
    address_line2?: string;

    @IsString()
    @IsOptional()
    city?: string;

    @IsString()
    @IsOptional()
    state?: string;

    @IsString()
    @IsOptional()
    pincode?: string;

    @IsString()
    @IsOptional()
    country?: string;
}

export class CreateCompanyDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsEmail()
    @IsNotEmpty()
    email: string;

    @IsString()
    @IsNotEmpty()
    phone_number?: string;

    @ValidateNested()
    @Type(() => CompanyDetailDto)
    @IsOptional()
    details?: CompanyDetailDto;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CompanyArnDto)
    @IsOptional()
    arns?: CompanyArnDto[];

    @IsString()
    @IsOptional()
    tenant_id?: string;
}
