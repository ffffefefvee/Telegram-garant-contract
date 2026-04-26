import { Module } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { TelegramDealHandler } from './telegram-deal.handler';
import { UserModule } from '../user/user.module';
import { I18nModule } from '../i18n/i18n.module';
import { DealModule } from '../deal/deal.module';

@Module({
  imports: [UserModule, I18nModule, DealModule],
  providers: [TelegramBotService, TelegramDealHandler],
  exports: [TelegramBotService],
})
export class TelegramBotModule {}
