import { IsNotEmpty, IsString, IsOptional, IsEmail } from 'class-validator';

export class CreateCompanyUserDto {
    @IsString()
    @IsNotEmpty()
    phone_number: string;

    @IsString()
    @IsOptional()
    first_name?: string;

    @IsString()
    @IsOptional()
    last_name?: string;

    @IsEmail()
    @IsOptional()
    email?: string;
}
