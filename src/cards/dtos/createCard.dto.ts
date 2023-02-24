import { ApiProperty } from '@nestjs/swagger';
import { SpendingLimitIntervalType } from './../card.schema';
import {
    IsEmail,
    IsString,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsNumberString,
} from 'class-validator';

export enum BrandType {
    MASTERCARD = 'MasterCard',
    VERVE = 'Verve',
}

export enum CurrencyPair {
    NGN = 'NGN',
    USD = 'USD',
}

export class CreateCardDto {
    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    currency: CurrencyPair;

    @ApiProperty()
    @IsNumberString()
    amount: string;

    // @ApiProperty()
    // @IsNumber()
    // @IsNotEmpty()
    // spendingLimitAmount: number

    // @ApiProperty()
    // @IsString()
    // @IsNotEmpty()
    // spendingLimitInterval: SpendingLimitIntervalType

    // @ApiProperty({
    //     description: 'Format MMM-YYYY example AUG-2025. All cards are subject to maximum of 3 years validity.'
    // })
    // @IsOptional()
    // expirationDate?: string

    // @ApiProperty()
    // @IsString()
    // accountNumber?: string

    // @ApiProperty()
    // @IsString()
    // bankCode: string
}