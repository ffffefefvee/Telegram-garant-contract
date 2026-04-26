import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Payment } from './entities/payment.entity';
import { PaymentStatus, PaymentType } from './enums/payment.enum';
import { CryptomusService, CryptomusPaymentParams } from './cryptomus.service';
import { CreatePaymentDto } from './dto/create-payment.dto';

@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);
  private readonly appUrl: string;

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    private readonly cryptomusService: CryptomusService,
    private readonly configService: ConfigService,
  ) {
    this.appUrl = this.configService.get('APP_URL', 'https://t.me/garant_bot');
  }

  /**
   * Создать платёж через Cryptomus
   */
  async createPayment(
    dealId: string,
    amount: number,
    userId: string,
    options?: {
      currency?: string;
      description?: string;
      escrowAddress?: string;
      network?: string;
    },
  ): Promise<{
    payment: Payment;
    paymentUrl: string;
    expiresAt: Date;
  }> {
    const currency = options?.currency || 'USD';
    const orderId = `DEAL_${dealId}_${Date.now()}`;

    // Создаём запись в БД
    const payment = this.paymentRepository.create({
      transactionId: orderId,
      type: PaymentType.DEAL_PAYMENT,
      userId,
      dealId,
      amount,
      currency,
      fee: amount * 0.05, // 5% комиссия
      status: PaymentStatus.PENDING,
      description: options?.description || `Payment for deal ${dealId}`,
      escrowAddress: options?.escrowAddress,
    });

    const savedPayment = await this.paymentRepository.save(payment);

    // Создаём платёж в Cryptomus
    // Если есть escrowAddress, шлем средства сразу на смарт-контракт
    const cryptomusParams: CryptomusPaymentParams = {
      amount: amount.toString(),
      currency,
      order_id: orderId,
      url_return: `${this.appUrl}/deal/${dealId}`,
      url_callback: `${this.appUrl}/api/webhook/cryptomus`,
      is_payment_multiple: false,
      lifetime: 3600,
      ...(options?.escrowAddress && { to_address: options.escrowAddress }),
      ...(options?.network && { network: options.network }),
    };

    try {
      const cryptomusResponse = await this.cryptomusService.createPayment(cryptomusParams);

      // Сохраняем данные Cryptomus
      savedPayment.cryptomusData = cryptomusResponse;
      savedPayment.paymentUrl = cryptomusResponse.url;
      savedPayment.expiresAt = new Date(Date.now() + 3600 * 1000);

      await this.paymentRepository.save(savedPayment);

      this.logger.log(`Payment created: ${orderId}, URL: ${cryptomusResponse.url}`);

      return {
        payment: savedPayment,
        paymentUrl: cryptomusResponse.url,
        expiresAt: savedPayment.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Cryptomus payment creation failed: ${error.message}`, error.stack);
      throw new BadRequestException(`Payment creation failed: ${error.message}`);
    }
  }

  /**
   * Обработать Webhook от Cryptomus
   */
  async handlePaymentWebhook(payload: any): Promise<void> {
    const { order_id, status, txid, currency_amount } = payload;

    this.logger.log(`Webhook received: ${order_id}, status: ${status}`);

    const payment = await this.paymentRepository.findOne({
      where: { transactionId: order_id },
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${order_id}`);
    }

    // Обновляем статус
    switch (status) {
      case 'paid':
        payment.status = PaymentStatus.COMPLETED;
        payment.paidAt = new Date();
        payment.txId = txid;
        payment.cryptoAmount = parseFloat(currency_amount);
        break;

      case 'processing':
        payment.status = PaymentStatus.PROCESSING;
        break;

      case 'refunded':
        payment.status = PaymentStatus.REFUNDED;
        payment.refundedAt = new Date();
        break;

      case 'cancelled':
      case 'expired':
        payment.status = PaymentStatus.EXPIRED;
        payment.failureReason = `Payment ${status}`;
        break;
    }

    payment.cryptomusData = { ...payment.cryptomusData, ...payload };
    await this.paymentRepository.save(payment);

    this.logger.log(`Payment ${order_id} status updated to: ${status}`);
  }

  /**
   * Получить платёж по ID
   */
  async findById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: ['deal'],
    });

    if (!payment) {
      throw new NotFoundException(`Payment not found: ${id}`);
    }

    return payment;
  }

  /**
   * Получить платежи пользователя
   */
  async getUserPayments(
    userId: string,
    limit: number = 20,
    offset: number = 0,
  ): Promise<{ payments: Payment[]; total: number }> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      where: { userId },
      relations: ['deal'],
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });

    return { payments, total };
  }

  /**
   * Проверить статус платежа в Cryptomus
   */
  async checkPaymentStatus(paymentId: string): Promise<Payment> {
    const payment = await this.findById(paymentId);

    if (payment.status === PaymentStatus.COMPLETED) {
      return payment;
    }

    const status = await this.cryptomusService.getPaymentStatus(payment.transactionId);

    if (status && status.status === 'paid') {
      payment.status = PaymentStatus.COMPLETED;
      payment.paidAt = new Date();
      payment.txId = status.txid;
      await this.paymentRepository.save(payment);
    }

    return payment;
  }

  async refundPayment(paymentId: string, reason: string, userId: string): Promise<Payment> {
    const payment = await this.findById(paymentId);

    if (payment.status !== PaymentStatus.COMPLETED) {
      throw new BadRequestException('Can only refund completed payments');
    }

    payment.status = PaymentStatus.REFUNDED;
    payment.refundReason = reason;
    payment.refundedAt = new Date();
    payment.refundedBy = userId;

    return this.paymentRepository.save(payment);
  }

  async findAllForAdmin(page: number = 1, limit: number = 20): Promise<{ payments: Payment[]; total: number }> {
    const [payments, total] = await this.paymentRepository.findAndCount({
      relations: ['user', 'deal'],
      take: limit,
      skip: (page - 1) * limit,
      order: { createdAt: 'DESC' },
    });
    return { payments, total };
  }

  async checkCryptomusStatus(paymentId: string): Promise<any> {
    const payment = await this.findById(paymentId);
    return this.cryptomusService.getPaymentStatus(payment.transactionId);
  }

  async getStats(): Promise<{ totalProcessed: number; totalAmount: number }> {
    const result = await this.paymentRepository
      .createQueryBuilder('payment')
      .select('COUNT(*)', 'totalProcessed')
      .addSelect('SUM(payment.amount)', 'totalAmount')
      .where('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getRawOne();
    return { totalProcessed: parseInt(result?.totalProcessed || '0'), totalAmount: parseFloat(result?.totalAmount || '0') };
  }

  async processCallback(data: any, sign: string): Promise<{ success: boolean }> {
    try {
      await this.handlePaymentWebhook(data);
      return { success: true };
    } catch (error) {
      this.logger.error(`Callback processing failed: ${error.message}`, error.stack);
      return { success: false };
    }
  }
}
