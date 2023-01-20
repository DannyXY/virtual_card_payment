import { BankNameEnquiryDto } from './dtos/bankNameEnquiry.dto';
import { CreateAccountDto, Type } from './dtos/createAccount.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AccountsService {
    constructor(@InjectModel(Account.name) private accountModel: Model<AccountDocument>, private configService: ConfigService, private usersService: UsersService) {}

    headers = {
        accept: 'application/json',
        "Authorization": `Bearer ${this.configService.get('SUDO_API_KEY')}`,
        'content-type': 'application/json',
    }


    async get() {
        return this.accountModel.find()
    }

    

    async getById(sudoID: string) {
        const account = await this.accountModel.findById(sudoID)

        if (!account) {
            throw new HttpException('Account with this id does not exist', HttpStatus.NOT_FOUND);
        }

        return account
    }

    async create(accountData: CreateAccountDto, userSudoID: string) {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts`: `${this.configService.get('SUDO_BASE_URL')}/accounts`

            

            const data = {
                type: accountData.type,
                currency: accountData.currency,
                accountType: accountData.accountType,
            }

            if (data.type === Type.WALLET) data['customerId'] = userSudoID

            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data
            }
                    
            const response = await axios.request(options);
            const account = await this.accountModel.create({
                sudoID: response.data._id,
                type: response.data?.type,
                accountName: response.data?.accountName,
                accountType: response.data?.accountType,
                currentBalance: response.data?.currentBalance,
                availableBalance: response.data?.availableBalance,
            })
            return account

        } catch (err) {
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }


    async getAccountBalance(accountSudoID: string) {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts/${accountSudoID}/balance`: `${this.configService.get('SUDO_BASE_URL')}/accounts/${accountSudoID}/balance`

           

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            }
                    
            const response = await axios.request(options);
    
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while fetching balance, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }



    

    async getAccountTransactions(accountSudoID: string) {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts/${accountSudoID}/transactions`: `${this.configService.get('SUDO_BASE_URL')}/accounts/${accountSudoID}/transactions`
           

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            }
                    
            const response = await axios.request(options);
    
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while fetching account transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }

    async getBankList() {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts/banks`: `${this.configService.get('SUDO_BASE_URL')}/accounts/banks`
           

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            }
                    
            const response = await axios.request(options);
    
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while fatching banks, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }

    async enquireBankName(bankEnquiry: BankNameEnquiryDto) {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts/transfer/name-enquiry`: `${this.configService.get('SUDO_BASE_URL')}/accounts/transfer/name-enquiry`

            

            const data = {
                bankCode: bankEnquiry.bankCode,
                accountNumber: bankEnquiry.accountNumber
            }


            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data
            }
                    
            const response = await axios.request(options);
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }


    async fundTransfer() {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts/transfer`: `${this.configService.get('SUDO_BASE_URL')}/accounts/transfer`

            

            const data = {
                
            }


            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data
            }
                    
            const response = await axios.request(options);
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }







    async getCardTransactions(sudoID: string) {
        try {
            const url = this.configService.get('NODE_ENV') == 'deveopment' ? `${this.configService.get('SUDO_BASE_TEST_URL')}/cards/${sudoID}/transactions`: `${this.configService.get('SUDO_BASE_URL')}/cards/${sudoID}/transactions`
           

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            }
                    
            const response = await axios.request(options);
    
            return response

        } catch (err) {
            throw new HttpException(
                'Something went wrong while sending card transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR
            )
        }
    }

}