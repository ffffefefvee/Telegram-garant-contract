import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { DealService, CreateDealDto, UpdateDealDto, CreateMessageDto, DealFilterDto } from './deal.service';
import { Deal } from './entities/deal.entity';
import { DealMessage } from './entities/deal-message.entity';
import { DealInvite } from './entities/deal-invite.entity';
import { DealStatus, DealSide } from './enums/deal.enum';
import { RequireAuthMiddleware } from '../auth/auth.middleware';

@Controller('deals')
export class DealController {
  constructor(private dealService: DealService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() data: CreateDealDto,
  ): Promise<Deal> {
    // User добавляется из middleware
    const user = (arguments[0] as any).user;
    return this.dealService.create(data, user);
  }

  @Get()
  async findMany(
    @Query() filter: DealFilterDto,
  ): Promise<{ deals: Deal[]; total: number }> {
    const user = (arguments[0] as any).user;
    return this.dealService.findMany(filter, user.id);
  }

  @Get('number/:number')
  async findByNumber(@Param('number') number: string): Promise<Deal> {
    return this.dealService.findByNumber(number);
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<Deal> {
    return this.dealService.findById(id, [
      'buyer',
      'seller',
      'messages',
      'attachments',
      'events',
    ]);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateDealDto,
  ): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.update(id, data, user.id);
  }

  @Post(':id/cancel')
  async cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.cancel(id, user.id, body.reason);
  }

  @Post(':id/accept')
  async accept(@Param('id', ParseUUIDPipe) id: string): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.accept(id, user.id);
  }

  @Post(':id/reject')
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.reject(id, user.id, body.reason);
  }

  @Post(':id/confirm')
  async confirmReceipt(@Param('id', ParseUUIDPipe) id: string): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.confirmReceipt(id, user.id);
  }

  @Post(':id/dispute')
  async openDispute(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ): Promise<Deal> {
    const user = (arguments[0] as any).user;
    return this.dealService.openDispute(id, user.id, body.reason);
  }

  @Get(':id/messages')
  async getMessages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', ParseIntPipe) limit: number = 50,
    @Query('offset', ParseIntPipe) offset: number = 0,
  ): Promise<DealMessage[]> {
    return this.dealService.getMessages(id, limit, offset);
  }

  @Post(':id/messages')
  async createMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { content: string },
  ): Promise<DealMessage> {
    const user = (arguments[0] as any).user;
    return this.dealService.createMessage({
      dealId: id,
      senderId: user.id,
      content: body.content,
    });
  }

  @Get(':id/events')
  async getEvents(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit', ParseIntPipe) limit: number = 50,
  ) {
    return this.dealService.getEvents(id, limit);
  }

  @Post(':id/invite')
  async createInvite(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      invitedUserId?: string;
      invitedUserTelegramId?: string;
      message?: string;
      expiresInHours?: number;
    },
  ): Promise<DealInvite> {
    const user = (arguments[0] as any).user;
    return this.dealService.createInvite(
      id,
      user.id,
      body.invitedUserId,
      body.invitedUserTelegramId,
      body.message,
      body.expiresInHours,
    );
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseUUIDPipe) id: string): Promise<{
    totalDeals: number;
    activeDeals: number;
    completedDeals: number;
    totalAmount: number;
    asBuyer: number;
    asSeller: number;
  }> {
    const user = (arguments[0] as any).user;
    return this.dealService.getUserStats(user.id);
  }
}
