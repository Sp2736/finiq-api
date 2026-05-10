import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthenticationController } from './authentication.controller';
import { AuthenticationService } from './authentication.service';
import { AuthenticationRepository } from './authentication.repository';
import { JwtStrategy } from './jwt.strategy';
import { OtpLog } from 'src/entities/otp-log.entity';
import { User } from 'src/entities/user.entity';
import { UserProfile } from 'src/entities/user-profile.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([OtpLog, User, UserProfile]),
        PassportModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'secret',
                signOptions: { expiresIn: '1h' },
            }),
        }),
    ],
    controllers: [AuthenticationController],
    providers: [AuthenticationService, AuthenticationRepository, JwtStrategy],
    exports: [AuthenticationService, AuthenticationRepository],
})
export class AuthenticationModule { }
