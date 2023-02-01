import { ApiProperty } from '@nestjs/swagger';
import { SpendingLimitIntervalType } from './../card.schema';
import { IsEmail, IsString, IsNotEmpty, IsNumber, IsOptional } from 'class-validator';

export enum BrandType {
    MASTERCARD = 'MasterCard',
    VERVE = 'Verve',
    VISA = 'Visa'
}

export enum CurrencyPair {
    NGA = 'NGN',
    USA = 'USD',
}

export class CreateCardDto {
    @IsString()
    @IsOptional()
    brand: BrandType;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    currency: CurrencyPair;

    @ApiProperty()
    @IsNumber()
    @IsNotEmpty()
    spendingLimitAmount: number;

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    spendingLimitInterval: SpendingLimitIntervalType;

    @ApiProperty({
        description:
            'Format MMM-YYYY example AUG-2025. All cards are subject to maximum of 3 years validity.',
    })
    @IsOptional()
    expirationDate?: string;

    // @ApiProperty()
    // @IsString()
    // accountNumber?: string

    // @ApiProperty()
    // @IsString()
    // bankCode: string
}