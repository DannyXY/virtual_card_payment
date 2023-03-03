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
import { AccountsService } from 'src/accounts/accounts.service';
import { Account, AccountDocument } from 'src/accounts/account.schema';

@Injectable()
export class UsersService {
    constructor(
        @InjectModel(User.name) private userModel: Model<UserDocument>,
        @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
        private configService: ConfigService,
    ) {}

    TOKEN =
        this.configService.get('NODE_ENV') === 'production'
            ? this.configService.get('SUDO_API_KEY')
            : this.configService.get('SUDO_API_DEV_KEY');

    headers = {
        accept: 'application/json',
        Authorization: `Bearer ${this.TOKEN}`,
        'content-type': 'application/json',
    };

    sudoApi = axios.create({
        baseURL:
            this.configService.get('NODE_ENV') === 'development'
                ? `${this.configService.get('SUDO_BASE_TEST_URL')}`
                : `${this.configService.get('SUDO_BASE_URL')}`,
        headers: this.headers,
    });

    async get() {
        return this.userModel.find();
    }

    async getByEmail(email: string) {
        const user = await this.userModel.findOne({ email });

        if (!user) {
            throw new HttpException(
                'User with this email does not exist',
                HttpStatus.NOT_FOUND,
            );
        }

        return user;
    }

    async getBySudoId(sudoID: string) {
        const user = await this.userModel.findOne({ sudoID: sudoID });

        if (!user) {
            throw new HttpException(
                'User with this id does not exist',
                HttpStatus.NOT_FOUND,
            );
        }

        return user;
    }

    async createUser(userData: CreateUserDto) {
        try {
            const hashedPassword = await bcrypt.hash(userData.password, 10);

            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/customers`
                    : `${this.configService.get('SUDO_BASE_URL')}/customers`;
            // individual
            const transformedPhoneNumber = userData.phoneNumber.replace(
                /^0/,
                '+234',
            );
            if (userData.customerType === CustomerType.INDIVIDUAL) {
                const sudoCustomer = await this.sudoApi({
                    method: 'POST',
                    url: '/customers',
                    data: {
                        type: 'individual',
                        individual: {
                            identity: { type: 'BVN', number: userData.bvn },
                            firstName: userData.firstName,
                            lastName: userData.lastName,
                            dob: userData.dob,
                        },
                        status: 'active',
                        billingAddress: {
                            line1: userData.address1,
                            city: userData.city,
                            state: userData.state,
                            postalCode: userData.postalCode,
                            country: userData.country,
                        },
                        name: userData.fullName,
                        phoneNumber: userData.phoneNumber,
                        emailAddress: userData.email,
                    },
                    //     {
                    //         "type": "individual",
                    //         "individual": {
                    //              "identity": {
                    //                   "type": "BVN",
                    //                   "number": "22912474187"
                    //              },
                    //              "firstName": "Bill",
                    //              "lastName": "Cosby",
                    //              "dob": "1999/11/12"
                    //         },
                    //         "status": "active",
                    //         "billingAddress": {
                    //              "line1": "9, Billy road",
                    //              "city": "Lagos",
                    //              "state": "Lagos",
                    //              "postalCode": "100242",
                    //              "country": "Nigeria"
                    //         },
                    //         "name": "Bill Cosby",
                    //         "phoneNumber": "7033519240",
                    //         "emailAddress": "bill2@example.com"
                    //    }
                });

                if (sudoCustomer.data.statusCode !== 200) {
                    throw new HttpException(
                        {
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Something went wrong',
                        },
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }
                const sudoCustomerWallet = await this.sudoApi({
                    method: 'POST',
                    url: '/accounts',
                    data: {
                        currency: 'NGN',
                        type: 'wallet',
                        accountType: 'Current',
                        customerId: sudoCustomer.data.data._id,
                    },
                });

                if (sudoCustomerWallet.status !== 201) {
                    throw new HttpException(
                        {
                            code: 'INTERNAL_SERVER_ERROR',
                            message: 'Something went wrong',
                        },
                        HttpStatus.INTERNAL_SERVER_ERROR,
                    );
                }
                const account = await this.accountModel.create({
                    sudoID: sudoCustomerWallet.data.data?._id,
                    type: sudoCustomerWallet.data.data?.type,
                    accountName: sudoCustomerWallet.data.data?.accountName,
                    accountType: sudoCustomerWallet.data.data?.accountType,
                    accountNumber: sudoCustomerWallet.data.data?.accountNumber,
                    currentBalance:
                        sudoCustomerWallet.data.data?.currentBalance,
                    availableBalance:
                        sudoCustomerWallet.data.data?.availableBalance,
                    bankCode: sudoCustomerWallet.data.data?.bankCode,
                });

                const user = await this.userModel.create({
                    sudoID: sudoCustomer.data.data._id,
                    customerType: sudoCustomer.data.data.type,
                    status: sudoCustomer.data.data.status,
                    email: sudoCustomer.data.data.emailAddress,
                    password: hashedPassword,
                    fullName: sudoCustomer.data.data.name,
                    phoneNumber: sudoCustomer.data.data?.phoneNumber,
                    address: sudoCustomer.data.data?.billingAddress?.line1,
                    city: sudoCustomer.data.data?.billingAddress?.city,
                    state: sudoCustomer.data.data?.billingAddress?.state,
                    postalCode:
                        sudoCustomer.data.data?.billingAddress?.postalCode,
                    country: sudoCustomer.data.data?.billingAddress?.country,
                    firstName: sudoCustomer.data.data?.individual?.firstName,
                    lastName: sudoCustomer.data.data?.individual?.lastName,
                    dob: sudoCustomer.data.data?.individual?.dob,
                    identityType:
                        sudoCustomer.data.data?.individual?.identity?.type,
                    identityNumber:
                        sudoCustomer.data.data?.individual?.identity?.number,
                    companyName: sudoCustomer.data.data?.company?.name,
                    companIdentityType:
                        sudoCustomer.data.data?.company?.identity?.type,
                    companyIdentityNumber:
                        sudoCustomer.data.data?.company?.identity?.number,
                    accountId: sudoCustomerWallet.data.data._id,
                });
                return user;
            }
        } catch (err) {
            console.log(err);
            if (err?.code === MongoError.DuplicateKey) {
                throw new HttpException(
                    'User with that email already exists',
                    HttpStatus.BAD_REQUEST,
                );
            }

            console.log(err);
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async delete(sudoID: string) {
        const user = await this.userModel.findOne({ sudoID: sudoID });

        if (!user) {
            throw new HttpException(
                'User with this id does not exist',
                HttpStatus.NOT_FOUND,
            );
        }

        await user.delete();
    }
}
