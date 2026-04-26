import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { PaymentService } from './payment.service';
import { Payment } from './entities/payment.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Controller('payments')
export class PaymentController {
  constructor(private paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createPayment(
    @Body() data: CreatePaymentDto,
  ): Promise<{
    payment: Payment;
    paymentUrl?: string;
    expiresAt?: Date;
  }> {
    const user = (arguments[0] as any).user;
    return this.paymentService.createPayment(data.dealId, data.amount, user.id, {
      currency: data.currency,
      description: data.description,
    });
  }

  @Get()
  async getMyPayments(
    @Query('limit', ParseIntPipe) limit: number = 20,
    @Query('offset', ParseIntPipe) offset: number = 0,
  ): Promise<{ payments: Payment[]; total: number }> {
    const user = (arguments[0] as any).user;
    return this.paymentService.getUserPayments(user.id, limit, offset);
  }

  @Get(':id')
  async getPayment(@Param('id', ParseUUIDPipe) id: string): Promise<Payment> {
    return this.paymentService.findById(id);
  }

  @Post(':id/check')
  async checkStatus(@Param('id', ParseUUIDPipe) id: string): Promise<Payment> {
    return this.paymentService.checkPaymentStatus(id);
  }

  @Post(':id/refund')
  async refund(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string },
  ): Promise<Payment> {
    const user = (arguments[0] as any).user;
    return this.paymentService.refundPayment(id, body.reason, user.id);
  }

  @Get('deal/:dealId')
  async getDealPayments(
    @Param('dealId') dealId: string,
  ): Promise<Payment[]> {
    // Возвращаем платежи для сделки
    const user = (arguments[0] as any).user;
    const { payments } = await this.paymentService.getUserPayments(user.id, 100, 0);
    return payments.filter((p) => p.dealId === dealId);
  }
}

@Controller('webhook')
export class WebhookController {
  constructor(private paymentService: PaymentService) {}

  @Post('cryptomus')
  @HttpCode(HttpStatus.OK)
  async handleCryptomusCallback(
    @Body() data: any,
    @Req() req: any,
  ): Promise<{ success: boolean }> {
    const sign = req.headers?.sign || '';
    const result = await this.paymentService.processCallback(data, sign);
    return { success: result.success };
  }
}
