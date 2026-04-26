import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Payment } from './entities/payment.entity';
import { CommissionRate } from './entities/commission-rate.entity';
import { CurrencyRate } from './entities/currency-rate.entity';
import { PaymentService } from './payment.service';
import { PaymentController, WebhookController } from './payment.controller';
import { CryptomusService } from './cryptomus.service';
import { CryptomusWebhookController } from './cryptomus-webhook.controller';
import { PaymentWebhookService } from './payment-webhook.service';
import { DealModule } from '../deal/deal.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, CommissionRate, CurrencyRate]),
    forwardRef(() => DealModule),
    forwardRef(() => UserModule),
  ],
  controllers: [PaymentController, WebhookController, CryptomusWebhookController],
  providers: [PaymentService, CryptomusService, PaymentWebhookService],
  exports: [PaymentService, CryptomusService, PaymentWebhookService, TypeOrmModule],
})
export class PaymentModule {}
