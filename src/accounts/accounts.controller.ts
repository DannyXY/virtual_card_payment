import { FundTransferDto } from './dtos/fundTransfer.dto';
import { JwtAuthGuard } from './../authentication/jwt-authentication.guard';
import { CreateAccountDto } from './dtos/createAccount.dto';
import { AccountsService } from './accounts.service';
import { Account } from './account.schema';
import  MongooseClassSerializerInterceptor  from 'src/utils/mongooseClassSerializer.interceptor';
import { Body, Controller, Get, Param, Post, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import RequestWithUser from 'src/authentication/requestWithUser.interface';
import { BankNameEnquiryDto } from './dtos/bankNameEnquiry.dto';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('accounts')
@ApiBearerAuth()
@ApiTags('Account')
@UseInterceptors(MongooseClassSerializerInterceptor(Account))
export class AccountsController {
    constructor(private accountsService: AccountsService) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getAllAccounts() {
        return this.accountsService.get();
    }

    @Get(':accountId')
    @UseGuards(JwtAuthGuard)
    async getAccount(@Param('accountId') accountId: string) {
        return this.accountsService.getBySudoId(accountId);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createAccount(
        @Body() accountData: CreateAccountDto,
        @Req() request: RequestWithUser,
    ) {
        return this.accountsService.create(accountData, request.user.sudoID);
    }

    @Get(':accountId/balance')
    @UseGuards(JwtAuthGuard)
    async getAccountBalance(@Param('accountId') accountId: string) {
        return this.accountsService.getAccountBalance(accountId);
    }

    @Get(':accountId/transactions')
    @UseGuards(JwtAuthGuard)
    async getAccountTransactions(@Param('accountId') accountId: string) {
        return this.accountsService.getAccountTransactions(accountId);
    }

    @Get('/banks')
    @UseGuards(JwtAuthGuard)
    async getBankList() {
        return this.getBankList();
    }

    @Post('/transfer/name-enquiry')
    @UseGuards(JwtAuthGuard)
    async enquireBankName(@Body() bankEnquiryData: BankNameEnquiryDto) {
        return this.accountsService.enquireBankName(bankEnquiryData);
    }

    @UseGuards(JwtAuthGuard)
    @Post(':id/transfer')
    async fundTransfer(
        @Body() transferData: FundTransferDto,
        @Param('id') id: string,
    ) {
        return this.accountsService.fundTransfer(transferData, id);
    }

    @UseGuards(JwtAuthGuard)
    @Get('transfer/rate')
    async getTransferRate() {
        return this.accountsService.getTransferRate('USDNGN');
    }
}
