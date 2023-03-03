import { UpdateCardDto } from './dtos/updateCard.dto';
import { UsersService } from './../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Card, CardDocument, CardStatusType } from './card.schema';
import {
    Injectable,
    HttpStatus,
    HttpException,
    InternalServerErrorException,
    BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BrandType, CreateCardDto, CurrencyPair } from './dtos/createCard.dto';
import axios from 'axios';
import { UserDocument } from 'src/users/user.schema';

@Injectable()
export class CardsService {
    constructor(
        @InjectModel(Card.name) private cardModel: Model<CardDocument>,
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
    sudoApi = axios.create({
        baseURL:
            this.configService.get('NODE_ENV') === 'development'
                ? `${this.configService.get('SUDO_BASE_TEST_URL')}`
                : `${this.configService.get('SUDO_BASE_URL')}`,
        headers: this.headers,
    });

    async get() {
        return this.cardModel.find();
    }

    async getBySudoId(sudoID: string) {
        const card = await this.cardModel.findOne({ sudoID });

        if (!card) {
            throw new HttpException(
                'Card with this id does not exist',
                HttpStatus.NOT_FOUND,
            );
        }

        return card;
    }

    async getCardInfo(id: string, token: string) {
        try {
            const vaultApi = await axios.create({
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                baseURL: 'https://vault.sudo.africa',
            });

            const numberResponse = await vaultApi({
                method: 'GET',
                url: `/cards/${id}/secure-data/number`,
            });
            const cvvResponse = await vaultApi({
                method: 'GET',
                url: `/cards/${id}/secure-data/cvv2`,
            });
            const pinResponse = await vaultApi({
                method: 'GET',
                url: `/cards/${id}/secure-data/defaultPin`,
            });

            return {
                number: numberResponse.data.data.number,
                pin: pinResponse.data.data.pin,
                cvv2: cvvResponse.data.data.cvv2,
            };
        } catch (err) {
            throw new InternalServerErrorException(
                'Something went wrong getting card info',
            );
        }
    }

    async create(cardData: CreateCardDto, user: UserDocument) {
        // try {
        const url =
            this.configService.get('NODE_ENV') === 'development'
                ? `${this.configService.get('SUDO_BASE_TEST_URL')}/cards`
                : `${this.configService.get('SUDO_BASE_URL')}/cards`;

        enum cardType {
            VIRTUAL = 'virtual',
        }

        if (parseInt(cardData.amount) <= 0) {
            throw new BadRequestException('Enter a valid amount');
        }

        const data = {
            customerId: user.sudoID,
            currency: cardData.currency,
            type: cardType.VIRTUAL,
            status: CardStatusType.ACTIVE,

            sendPINSMS: false,
            // bankCode: cardData?.bankCode,
            // accountNumber: cardData.accountNumber
        };

        if (data.currency === CurrencyPair.USD) {
            data['brand'] = BrandType.MASTERCARD;
            data['issuerCountry'] = 'USA';
        } else if (data.currency === CurrencyPair.NGN) {
            data['brand'] = BrandType.VERVE;
            data['issuerCountry'] = 'NGN';
        }
        //   get user sudo wallet balance
        const sudoCustomerBalance = await this.sudoApi({
            method: 'GET',
            url: `/accounts/${user.accountId}/balance`,
        });

        if (sudoCustomerBalance.data.statusCode !== 200) {
            throw new HttpException(
                {
                    code: 'BAD_REQUEST',
                    message: 'Something went wrong',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        // creation of dollar card
        if (data.currency === 'USD') {
            // Fetch exchange rate
            const sudoExchangeRate = await this.sudoApi({
                method: 'GET',
                url: `/accounts/transfer/rate/USDNGN`,
            });

            if (sudoExchangeRate.data.statusCode !== 200)
                throw new HttpException(
                    {
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Something went wrong',
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );

            // convert user dollar amount to
            const conertCardCreationFee =
                parseInt(this.configService.get('CARD_CREATION_FEE_DOLLAR')) *
                (parseInt(sudoExchangeRate.data.data.rate) +
                    parseInt(this.configService.get('FUNDING_FEE_NAIRA')));
            const nairaAmount =
                parseInt(cardData.amount) *
                (parseInt(sudoExchangeRate.data.data.rate) +
                    parseInt(this.configService.get('FUNDING_FEE_NAIRA')));

            const totalAmount = conertCardCreationFee + nairaAmount;

            // check if user has enough balance
            if (sudoCustomerBalance.data.data.currentBalance < totalAmount) {
                throw new HttpException(
                    {
                        code: 'BAD_REQUEST',
                        message: 'Insufficient funds',
                    },
                    HttpStatus.BAD_REQUEST,
                );
            }

            // debit user naira balance
            const sudoDebitCustomerBalance = await this.sudoApi({
                method: 'POST',
                url: '/accounts/transfer',
                data: {
                    debitAccountId: user.accountId,
                    creditAccountId: this.configService.get(
                        'SUDO_NGN_ACCOUNT_ID',
                    ),
                    amount: totalAmount,
                    narration: 'card creation',
                    paymentReference: `${Math.floor(
                        Math.random() * 10000000000,
                    )}`,
                },
            });
            if (sudoDebitCustomerBalance.status !== 201) {
                throw new HttpException(
                    {
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Something went wrong',
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }

            // create card
            const sudoCreateCard = await this.sudoApi({
                method: 'POST',
                url: '/cards',
                data: {
                    customerId: user.sudoID,
                    debitAccountId: this.configService.get(
                        'SUDO_USD_ACCOUNT_ID',
                    ),
                    issuerCountry: 'USA',
                    type: 'virtual',
                    currency: 'USD',
                    status: 'active',
                    metadata: {},
                    brand: 'MasterCard',
                    amount: parseInt(cardData.amount),
                },
            });

            if (sudoCreateCard.data.statusCode !== 201) {
                const sudoCrebitCustomerBalance = await this.sudoApi({
                    method: 'POST',
                    url: '/accounts/transfer',
                    data: {
                        creditAccountId: user.accountId,
                        debitAccountId: this.configService.get(
                            'SUDO_NGN_ACCOUNT_ID',
                        ),
                        amount: totalAmount,
                        narration: 'card creation refund',
                        paymentReference: `${Math.floor(
                            Math.random() * 10000000000,
                        )}`,
                    },
                });
                throw new HttpException(
                    {
                        code: 'INTERNAL_SERVER_ERROR',
                        message: 'Card creation failed',
                    },
                    HttpStatus.INTERNAL_SERVER_ERROR,
                );
            }

            const card = await this.cardModel.create({
                sudoID: sudoCreateCard.data.data?._id,
                type: sudoCreateCard.data.data?.type,
                brand: sudoCreateCard.data.data?.brand,
                currency: sudoCreateCard.data.data?.currency,
                maskedPan: sudoCreateCard.data.data?.maskedPan,
                expiryMonth: sudoCreateCard.data.data?.expiryMonth,
                expiryYear: sudoCreateCard.data.data?.expiryYear,
                status: sudoCreateCard.data.data?.status,
                atmChannel:
                    sudoCreateCard.data.data?.spendingControls?.channels?.atm,
                posChannel:
                    sudoCreateCard.data.data?.spendingControls?.channels?.pos,
                webChannel:
                    sudoCreateCard.data.data?.spendingControls?.channels?.web,
                mobileChannel:
                    sudoCreateCard.data.data?.spendingControls?.channels
                        ?.mobile,
                spendingLimitAmount:
                    sudoCreateCard.data.data?.spendingControls?.spendingLimits
                        ?.amount,
                spendingLimitInterval:
                    sudoCreateCard.data.data?.spendingControls?.spendingLimits
                        ?.interval,
            });
            return card;
        }

        // creation of naira card

        // check if user has enough balance
        if (
            sudoCustomerBalance.data.data.currentBalance <
            parseInt(cardData.amount)
        ) {
            throw new HttpException(
                {
                    code: 'BAD_REQUEST',
                    message: 'Insufficient funds',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        const sudoCustomerWallet = await this.sudoApi({
            method: 'GET',
            url: `/accounts/${user.accountId}`,
        });

        if (sudoCustomerWallet.data.statusCode !== 200) {
            throw new HttpException(
                {
                    code: 'BAD_REQUEST',
                    message: 'Something went wrong',
                },
                HttpStatus.BAD_REQUEST,
            );
        }

        // debit user naira balance
        const sudoDebitCustomerBalance = await this.sudoApi({
            method: 'POST',
            url: '/accounts/transfer',
            data: {
                debitAccountId: user.accountId,
                creditAccountId: this.configService.get('SUDO_NGN_ACCOUNT_ID'),
                amount: parseInt(cardData.amount),
                narration: 'card creation',
                paymentReference: `${Math.floor(Math.random() * 10000000000)}`,
            },
        });
        if (sudoDebitCustomerBalance.status !== 201) {
            throw new HttpException(
                {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Something went wrong',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }

        // create card

        const sudoCreateCard = await this.sudoApi({
            method: 'POST',
            url: '/cards',
            data: {
                customerId: user.sudoID,
                debitAccountId: this.configService.get('SUDO_NGN_ACCOUNT_ID'),
                issuerCountry: 'NGA',
                type: 'virtual',
                currency: 'NGN',
                status: 'active',
                metadata: {},
                brand: 'Verve',
                amount: parseInt(cardData.amount),
            },
        });

        if (sudoCreateCard.data.statusCode !== 200) {
            // debit user naira balance
            const sudoDebitCustomerBalance = await this.sudoApi({
                method: 'POST',
                url: '/accounts/transfer',
                data: {
                    debitAccountId: this.configService.get(
                        'SUDO_NGN_ACCOUNT_ID',
                    ),
                    creditAccountId: user.accountId,
                    amount: parseInt(cardData.amount),
                    narration: 'card creation - reversal',
                    paymentReference: `${Math.floor(
                        Math.random() * 10000000000,
                    )}`,
                },
            });
            throw new HttpException(
                {
                    code: 'INTERNAL_SERVER_ERROR',
                    message: 'Card creation failed',
                },
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
        const card = await this.cardModel.create({
            sudoID: sudoCreateCard.data.data?._id,
            type: sudoCreateCard.data.data?.type,
            brand: sudoCreateCard.data.data?.brand,
            currency: sudoCreateCard.data.data?.currency,
            maskedPan: sudoCreateCard.data.data?.maskedPan,
            expiryMonth: sudoCreateCard.data.data?.expiryMonth,
            expiryYear: sudoCreateCard.data.data?.expiryYear,
            status: sudoCreateCard.data.data?.status,
            atmChannel:
                sudoCreateCard.data.data?.spendingControls?.channels?.atm,
            posChannel:
                sudoCreateCard.data.data?.spendingControls?.channels?.pos,
            webChannel:
                sudoCreateCard.data.data?.spendingControls?.channels?.web,
            mobileChannel:
                sudoCreateCard.data.data?.spendingControls?.channels?.mobile,
            spendingLimitAmount:
                sudoCreateCard.data.data?.spendingControls?.spendingLimits
                    ?.amount,
            spendingLimitInterval:
                sudoCreateCard.data.data?.spendingControls?.spendingLimits
                    ?.interval,
        });
        return card;
    }

    async getCustomerCards(userSudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/cards/customer/${userSudoID}`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/cards/customer/${userSudoID}`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while creating a card, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async updateCard(sudoID: string, cardData: UpdateCardDto) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/cards/${sudoID}`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/cards/${sudoID}`;

            const data = {
                status: CardStatusType.ACTIVE,
                spendingControls: {
                    spendingLimits: [
                        {
                            amount: cardData?.spendingLimitAmount,
                            interval: cardData?.spendingLimitInterval,
                        },
                    ],
                },
            };

            const options = {
                method: 'PUT',
                url: url,
                headers: this.headers,
                data: data,
            };

            const response = await axios.request(options);
            const card = await this.cardModel.findOneAndUpdate(
                { sudoID },
                {
                    status: response.data.data?.status,
                    spendingLimitAmount:
                        response.data.data?.spendingControls?.spendingLimits
                            ?.amount,
                    spendingLimitInterval:
                        response.data.data?.spendingControls?.spendingLimits
                            ?.interval,
                },
            );
            return card;
        } catch (err) {
            throw new HttpException(
                'Something went wrong while updating card, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async generateCardToken(sudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/cards/${sudoID}/token`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/cards/${sudoID}/token`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {

            throw new HttpException(
                'Something went wrong while generating card token, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getAllTransactions() {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/cards/transactions`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/cards/transactions`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            console.log(err);
            throw new HttpException(
                'Something went wrong while sending transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getCardTransactions(sudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') === 'development'
                    ? `${this.configService.get(
                          'SUDO_BASE_TEST_URL',
                      )}/cards/${sudoID}/transactions`
                    : `${this.configService.get(
                          'SUDO_BASE_URL',
                      )}/cards/${sudoID}/transactions`;

            const options = {
                method: 'GET',
                url: url,
                headers: this.headers,
            };

            const response = await axios.request(options);

            return response.data;
        } catch (err) {
            console.log(err.response.data.message);
            throw new HttpException(
                'Something went wrong while sending card transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}



