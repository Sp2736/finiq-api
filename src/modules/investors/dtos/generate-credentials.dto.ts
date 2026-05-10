import { IsString, IsNotEmpty, IsEmail } from 'class-validator';

export class GenerateCredentialsDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
