import { UpdateCardDto } from './dtos/updateCard.dto';
import { UsersService } from './../users/users.service';
import { ConfigService } from '@nestjs/config';
import { Card, CardDocument, CardStatusType } from './card.schema';
import { Injectable, HttpStatus, HttpException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BrandType, CreateCardDto, CurrencyPair } from './dtos/createCard.dto';
import axios from 'axios';

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

    async create(cardData: CreateCardDto, userSudoID: string) {
        try {
            const url = `${this.configService.get('SUDO_BASE_TEST_URL')}/cards`;

            enum cardType {
                VIRTUAL = 'virtual',
            }

            if (cardData.currency == CurrencyPair.NGA) {
                cardData.brand = BrandType.VERVE;
            } else {
                cardData.brand = BrandType.MASTERCARD;
            }

            const data = {
                customerId: userSudoID,
                type: cardType.VIRTUAL,
                brand: cardData.brand,
                currency: cardData.currency,
                status: CardStatusType.ACTIVE,

                spendingControls: {
                    allowedCategories: ["'"],
                    blockedCategories: ["'"],
                    channels: {
                        atm: true,
                        pos: true,
                        web: true,
                        mobile: true,
                    },
                    spendingLimits: [
                        {
                            amount: cardData.spendingLimitAmount,
                            interval: cardData.spendingLimitInterval,
                        },
                    ],
                },
                sendPINSMS: false,
                // bankCode: cardData?.bankCode,
                // accountNumber: cardData.accountNumber
            };

            const options = {
                method: 'POST',
                url: url,
                headers: this.headers,
                data: data,
            };

            console.log(data);

            const response = await axios.request(options);
            console.log(response.data);
            const card = await this.cardModel.create({
                sudoID: response.data.data?._id,
                type: response.data.data?.type,
                brand: response.data.data?.brand,
                currency: response.data.data?.currency,
                maskedPan: response.data.data?.maskedPan,
                expiryMonth: response.data.data?.expiryMonth,
                expiryYear: response.data.data?.expiryYear,
                status: response.data.data?.status,
                atmChannel: response.data.data?.spendingControls?.channels?.atm,
                posChannel: response.data.data?.spendingControls?.channels?.pos,
                webChannel: response.data.data?.spendingControls?.channels?.web,
                mobileChannel:
                    response.data.data?.spendingControls?.channels?.mobile,
                spendingLimitAmount:
                    response.data.data?.spendingControls?.spendingLimits
                        ?.amount,
                spendingLimitInterval:
                    response.data.data?.spendingControls?.spendingLimits
                        ?.interval,
            });
            return card;
        } catch (err) {
            console.log(err.response.data.message[0].children);
            console.log(err.response.data.message[0].target);
            console.log(err.response.data.message[0]);
            throw new HttpException(
                'Something went wrong while creating a card, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getCustomerCards(userSudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') == 'deveopment'
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
                this.configService.get('NODE_ENV') == 'deveopment'
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
                this.configService.get('NODE_ENV') == 'deveopment'
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

            return response;
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
                this.configService.get('NODE_ENV') == 'deveopment'
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
            throw new HttpException(
                'Something went wrong while sending transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    async getCardTransactions(sudoID: string) {
        try {
            const url =
                this.configService.get('NODE_ENV') == 'deveopment'
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
            throw new HttpException(
                'Something went wrong while sending card transactions, Try again!',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
