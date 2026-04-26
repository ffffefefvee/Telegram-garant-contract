import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Payment } from './entities/payment.entity';
import { CryptomusWebhookPayload } from './cryptomus.service';

export enum WebhookStatus {
  PAID = 'paid',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
  PROCESSING = 'processing',
}

@Injectable()
export class PaymentWebhookService {
  private readonly logger = new Logger(PaymentWebhookService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  /**
   * Обработать Webhook от Cryptomus
   */
  async handlePaymentWebhook(payload: CryptomusWebhookPayload): Promise<void> {
    const { order_id, status, txid, amount, currency_amount, network } = payload;

    this.logger.log(`Processing webhook for order: ${order_id}, status: ${status}`);

    // Найти платёж по order_id
    const payment = await this.paymentRepository.findOne({
      where: { transactionId: order_id },
      relations: ['deal'],
    });

    if (!payment) {
      this.logger.error(`Payment not found: ${order_id}`);
      throw new NotFoundException(`Payment not found: ${order_id}`);
    }

    // Обновить статус
    switch (status) {
      case WebhookStatus.PAID:
        await this.handlePaymentCompleted(payment, txid, currency_amount);
        break;

      case WebhookStatus.PROCESSING:
        await this.handlePaymentProcessing(payment);
        break;

      case WebhookStatus.REFUNDED:
        await this.handlePaymentRefunded(payment);
        break;

      case WebhookStatus.CANCELLED:
      case WebhookStatus.EXPIRED:
        await this.handlePaymentFailed(payment, status);
        break;

      default:
        this.logger.warn(`Unknown webhook status: ${status}`);
    }
  }

  /**
   * Платёж успешно завершён
   */
  private async handlePaymentCompleted(
    payment: Payment,
    txid: string,
    cryptoAmount: string,
  ): Promise<void> {
    this.logger.log(`Payment completed: ${payment.transactionId}, TX: ${txid}`);

    payment.status = 'completed' as any;
    payment.paidAt = new Date();
    payment.txId = txid;
    payment.cryptoAmount = parseFloat(cryptoAmount);
    payment.cryptomusData = {
      ...payment.cryptomusData,
      paidAt: new Date().toISOString(),
      txid,
    };

    await this.paymentRepository.save(payment);

    // TODO: Эмитить событие для обновления сделки
    // this.events.emit('payment.completed', { paymentId: payment.id });
  }

  /**
   * Платёж в обработке
   */
  private async handlePaymentProcessing(payment: Payment): Promise<void> {
    this.logger.log(`Payment processing: ${payment.transactionId}`);

    payment.status = 'processing' as any;
    await this.paymentRepository.save(payment);
  }

  /**
   * Возврат средств
   */
  private async handlePaymentRefunded(payment: Payment): Promise<void> {
    this.logger.log(`Payment refunded: ${payment.transactionId}`);

    payment.status = 'refunded' as any;
    payment.refundedAt = new Date();
    await this.paymentRepository.save(payment);
  }

  /**
   * Платёж отменён или истёк
   */
  private async handlePaymentFailed(
    payment: Payment,
    status: string,
  ): Promise<void> {
    this.logger.log(`Payment failed: ${payment.transactionId}, status: ${status}`);

    payment.status = 'failed' as any;
    payment.failureReason = `Payment ${status}`;
    await this.paymentRepository.save(payment);
  }
}
