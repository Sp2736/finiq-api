import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { InvestorAuthController } from './investor-auth.controller';
import { InvestorAuthService } from './investor-auth.service';
import { AuthenticationModule } from '../auth/authentication.module';
import { Investor } from 'src/entities/investor.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Investor]),
        AuthenticationModule, // Import to use AuthenticationRepository
        ConfigModule,         // Required for ConfigService injection in InvestorAuthService
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secret',
                signOptions: { expiresIn: '7d' }, // Longer session for investors?
            }),
        }),
    ],
    controllers: [InvestorAuthController],
    providers: [InvestorAuthService],
})
export class InvestorAuthModule { }
