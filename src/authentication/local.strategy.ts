import {Strategy} from 'passport-local'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'
import { AuthenticationService } from './authentication.service'
import { User } from 'src/users/user.schema'


@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
    constructor(private authenticationService: AuthenticationService) {
        super({
            usernameField: 'email'
        })
    }

    async validate(email: string, password: string): Promise<User>{
        console.log(email);
        return this.authenticationService.getAuthenticatedUser(email, password)
    }
}