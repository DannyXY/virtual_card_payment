import { FundTransferDto } from './dtos/fundTransfer.dto';
import { BankNameEnquiryDto } from './dtos/bankNameEnquiry.dto';
import { CreateAccountDto, AccountType, Type } from './dtos/createAccount.dto';
import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Account, AccountDocument } from './account.schema';
import { UsersService } from 'src/users/users.service';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class AccountsService {
    constructor(
        @InjectModel(Account.name) private accountModel: Model<AccountDocument>,
        private configService: ConfigService,
        private usersService: UsersService,
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

    async get() {
        return this.accountModel.find();
    }

    async getBySudoId(sudoID: string) {
        const account = await this.accountModel.findOne({ sudoID });
        console.log(account, sudoID);
        if (!account) {
            throw new HttpException(
                'Account with this id does not exist',
                HttpStatus.NOT_FOUND,
            );
        }
        const options = {
            method: 'GET',
            url: `${this.configService.get(
                'SUDO_BASE_URL',
            )}/accounts/${sudoID}`,
            headers: this.headers,
        };

        const sudoCustomerWallet = await axios.request(options);

        await this.accountModel.findOneAndUpdate(
            { sudoID },
            {
                currentBalance: sudoCustomerWallet.data.data.currentBalance,
                availableBalance: sudoCustomerWallet.data.data.availableBalance,
            },
        );

        return this.accountModel.findOne({ sudoID });
    }

    async create(accountData: CreateAccountDto, userSudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get('SUDO_BASE_TEST_URL')}/accounts`
                    : `${this.configService.get('SUDO_BASE_URL')}/accounts`;

            const data = {
                type: accountData.type,
                currency: accountData.currency,
                accountType: accountData.accountType,
            };

            if (data.type === Type.WALLET) data['customerId'] = userSudoID;

            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data,
            };

            const response = await axios.request(options);
            const account = await this.accountModel.create({
                sudoID: response.data.data?._id,
                type: response.data.data?.type,
                accountName: response.data.data?.accountName,
                accountType: response.data.data?.accountType,
                currentBalance: response.data.data?.currentBalance,
                availableBalance: response.data.data?.availableBalance,
                bankCode: response.data.data?.bankCode,
            });
            return account;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while creating an account, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getAccountBalance(accountSudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/${accountSudoID}/balance`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/${accountSudoID}/balance`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while fetching balance, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getAccountTransactions(accountSudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/${accountSudoID}/transactions`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/${accountSudoID}/transactions`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while fetching account transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getBankList() {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/banks`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/banks`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while fatching banks, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async enquireBankName(bankEnquiry: BankNameEnquiryDto) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/transfer/name-enquiry`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/transfer/name-enquiry`;

            const data = {
                bankCode: bankEnquiry.bankCode,
                accountNumber: bankEnquiry.accountNumber,
            };

            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data,
            };

            const response = await axios.request(options);
            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while making bank enquiry, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async fundTransfer(transferData: FundTransferDto, sudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/transfer`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/transfer`;

            const account = await this.getBySudoId(sudoID);

            const data = {
                debitAccountId: account.sudoID,
                beneficiaryBankCode: transferData,
                beneficiaryAccountNumber: transferData.beneficiaryAccountNumber,
                amount: transferData.amount,
                naration: transferData?.narration,
            };

            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data,
            };

            const response = await axios.request(options);
            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while funding transfer, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getTransferRate(currencyPair: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/accounts/transfer/rate/${currencyPair}`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/accounts/transfer/rate/${currencyPair}`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while sending transfer rate, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
