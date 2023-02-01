import { ConfigService } from '@nestjs/config';

import { CreateUserDto, CustomerType, IdentityType } from './dtos/createUserDto.dto';
import { User, UserDocument } from './user.schema';
import { HttpException, HttpStatus, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs'
import crypto from 'crypto';
import axios  from 'axios';
import MongoError from 'src/utils/mongoError.enum';



@Injectable()
export class UsersService {
    constructor(@InjectModel(User.name) private userModel: Model<UserDocument>, private configService: ConfigService) {
    }

    TOKEN = this.configService.get('NODE_ENV') === 'production'? this.configService.get('SUDO_API_KEY'): this.configService.get('SUDO_API_DEV_KEY')
   
    headers = {
        'accept': 'application/json',
        "Authorization": `Bearer ${this.TOKEN}`,
        'content-type': 'application/json',
    }




    async get() {
        return this.userModel.find()
    }

    async getByEmail(email: string) {
        const user = await this.userModel.findOne({ email })

        if (!user) {
            throw new HttpException('User with this email does not exist', HttpStatus.NOT_FOUND);
        }

        return user
    }

    

    async getBySudoId(sudoID: string) {
        const user = await this.userModel.findOne({ sudoID: sudoID})

        if (!user) {
            throw new HttpException('User with this id does not exist', HttpStatus.NOT_FOUND);
        }

        return user
    }

    async createUser(userData: CreateUserDto) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10)

            const url = `${this.configService.get('SUDO_BASE_TEST_URL')}/customers`;
            const individualData = {
                type: userData.customerType,
                name: userData.fullName,
                phoneNumber: userData.phoneNumber,
                emailAddress: userData.email,
                status: 'active',
                billingAddress: {
                    line1: userData.address,
                    city: userData.city,
                    state: userData.state,
                    postalCode: userData.postalCode,
                    country: userData.country
                },
                individual: {
                    firstName: userData.firstName,
                    lastName: userData.lastName,
                    dob: userData.dob,
                    identity: {
                        type: userData.identityType,
                        number: userData.identityNumber
                    }
                }
            }

            const companyData = {
                type: userData.customerType,
                name: userData.fullName,
                phoneNumber: userData.phoneNumber,
                emailAddress: userData.email,
                status: 'active',
                billingAddress: {
                    line1: userData.address,
                    city: userData.city,
                    state: userData.state,
                    postalCode: userData.postalCode,
                    country: userData.country
                },
                company: {
                    name: userData.companyName,
                    identity: {
                        type: userData.identityType,
                        number: userData.identityNumber
                    }
                }
            }

            let data = {}

            if (userData.customerType === CustomerType.INDIVIDUAL) {
                data = {
                    ...individualData
                }
            } else if (userData.identityType === CustomerType.COMPANY) {
                data = {
                    ...companyData
                }
            }

            // console.log(data)


            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data
            }
                    
            const response = await axios.request(options);

            const user = await this.userModel.create({
                sudoID: response.data.data._id,
                customerType : response.data.data.type,
                status: response.data.data.status,
                email: response.data.data.emailAddress,
                password: hashedPassword,
                fullName: response.data.data.name,
                phoneNumber: response.data.data?.phoneNumber,
                address: response.data.data?.billingAddress?.line1,
                city: response.data.data?.billingAddress?.city,
                state: response.data.data?.billingAddress?.state,
                postalCode: response.data.data?.billingAddress?.postalCode,
                country: response.data.data?.billingAddress?.country,
                firstName: response.data.data?.individual?.firstName,
                lastName: response.data.data?.individual?.lastName,
                dob: response.data.data?.individual?.dob,
                identityType: response.data.data?.individual?.identity?.type,
                identityNumber: response.data.data?.individual?.identity?.number,
                companyName: response.data.data?.company?.name,
                companIdentityType: response.data.data?.company?.identity?.type ,
                companyIdentityNumber: response.data.data?.company?.identity?.number,
            })
            return user

        } catch (err) {
            console.log(err);
            if (err?.code === MongoError.DuplicateKey) {
                throw new HttpException(
                    'User with that email already exists',
                    HttpStatus.BAD_REQUEST
                )
            }
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }




    async delete(sudoID: string) {
        const user = await this.userModel.findOne({ sudoID: sudoID })

        if (!user) {
            throw new HttpException('User with this id does not exist', HttpStatus.NOT_FOUND);
        } 

        await user.delete()
    }

   


}
