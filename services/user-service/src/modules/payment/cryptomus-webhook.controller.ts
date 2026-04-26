import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { CryptomusService, CryptomusWebhookPayload } from './cryptomus.service';
import { PaymentService } from './payment.service';

/**
 * Контроллер для обработки Webhook от Cryptomus
 */
@Controller('api/webhook/cryptomus')
export class CryptomusWebhookController {
  private readonly logger = new Logger(CryptomusWebhookController.name);

  constructor(
    private readonly cryptomusService: CryptomusService,
    private readonly paymentService: PaymentService,
  ) {}

  /**
   * Обработка Callback от Cryptomus
   *
   * Cryptomus отправляет POST запрос при изменении статуса платежа
   */
  @Post()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Body() payload: CryptomusWebhookPayload,
    @Headers('sign') signature: string,
  ): Promise<{ state: number }> {
    this.logger.log(`Webhook received: ${JSON.stringify(payload)}`);

    try {
      // Верифицируем подпись и обрабатываем
      const isValid = await this.cryptomusService.handleWebhook(
        payload,
        signature,
      );

      if (!isValid) {
        this.logger.error('Invalid webhook signature');
        return { state: 1 }; // Ошибка
      }

      // Обновляем статус платежа в БД
      await this.paymentService.handlePaymentWebhook(payload);

      return { state: 0 }; // Успех
    } catch (error) {
      this.logger.error(`Webhook processing error: ${error.message}`, error.stack);
      return { state: 1 }; // Ошибка
    }
  }
}
