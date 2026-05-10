import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor(private readonly configService: ConfigService) {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: configService.get<string>('JWT_SECRET') || 'secret', // TODO: Enforce ENV
        });
    }

    async validate(payload: any) {
        if (payload.investor_id) {
            return {
                id: payload.investor_id,
                mobile: payload.mobile,
                type: 'investor'
            };
        }
        return {
            id: payload.sub,
            phone_number: payload.phone_number,
            roles: payload.roles,
            type: 'user'
        };
    }
}
