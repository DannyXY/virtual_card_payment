import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { UsersService } from '../users/users.service';
import TokenPayload from './tokenPayload.interface';
 
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly userService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([(request: Request) => {
        let token;
        if (request.headers.authorization || request.headers.authorization.startsWith('Bearer')) {
          token = request?.headers?.authorization.split(' ')[1];
        }
        return token
      }]),
      secretOrKey: configService.get('JWT_ACCESS_TOKEN_SECRET')
    });
  }
 
  async validate(payload: TokenPayload) {
    console.log(payload);
    return this.userService.getBySudoId(payload.userId);
  }
}







