import { UsersService } from 'src/users/users.service';
import { User } from 'src/users/user.schema';
import  MongooseClassSerializerInterceptor from 'src/utils/mongooseClassSerializer.interceptor';
import { Controller, Get, Param, Post, UseInterceptors } from '@nestjs/common';

@Controller('users')
@UseInterceptors(MongooseClassSerializerInterceptor(User))
export class UsersController {
    constructor(private usersService: UsersService) {

    }

    @Get()
    async getUsers() {
        return this.usersService.get()
    }

    @Get(':id')
    async getUser(@Param() id: string) {
        return this.usersService.getById(id)
    }

}



