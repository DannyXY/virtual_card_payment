import { Card } from './card.schema';
import { UpdateCardDto } from './dtos/updateCard.dto';
import  RequestWithUser  from 'src/authentication/requestWithUser.interface';
import { JwtAuthGuard } from './../authentication/jwt-authentication.guard';
import { CreateCardDto } from './dtos/createCard.dto';
import { CardsService } from './cards.service';
import { Body, Controller, Get, Param, Post, Put, Req, UseGuards, UseInterceptors } from '@nestjs/common';
import MongooseClassSerializerInterceptor from 'src/utils/mongooseClassSerializer.interceptor';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@Controller('cards')
@ApiTags('Cards')
@ApiBearerAuth()
@UseInterceptors(MongooseClassSerializerInterceptor(Card))
export class CardsController {
    constructor(private cardsService: CardsService) {}

    @Get()
    @UseGuards(JwtAuthGuard)
    async getCards() {
        return this.cardsService.get();
    }

    @Get('/customer')
    @UseGuards(JwtAuthGuard)
    async getCustomerCards(@Req() request: RequestWithUser) {
        return this.cardsService.getCustomerCards(request.user.sudoID);
    }

    @Get('transactions')
    @UseGuards(JwtAuthGuard)
    async getAllTransactions() {
        return this.getAllTransactions();
    }

    @Get(':id')
    @UseGuards(JwtAuthGuard)
    async getCard(@Param('id') id: string) {
        return this.cardsService.getBySudoId(id);
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    async createCard(
        @Body() cardData: CreateCardDto,
        @Req() request: RequestWithUser,
    ) {
        return this.cardsService.create(cardData, request.user);
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    async updateCard(
        @Body() cardData: UpdateCardDto,
        @Req() request: RequestWithUser,
        @Param('id') id: string,
    ) {
        return this.cardsService.updateCard(id, cardData);
    }
    @Get('/cards/:id/token')
    @UseGuards(JwtAuthGuard)
    async generateCardToken(@Param('id') id: string) {
        return this.cardsService.generateCardToken(id);
    }
    @Get(':cardId/transactions')
    @UseGuards(JwtAuthGuard)
    async getCardTransactions(@Param('cardId') cardId: string) {
        return this.cardsService.getCardTransactions(cardId);
    }

    @Get('/cards/:id/info/:token')
    @UseGuards(JwtAuthGuard)
    async getCardDetails(
        @Param('id') id: string,
        @Param('token') token: string,
    ) {
        return this.cardsService.getCardInfo(id, token);
    }
}
