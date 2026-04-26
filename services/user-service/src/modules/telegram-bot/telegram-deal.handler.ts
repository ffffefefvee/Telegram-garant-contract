import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf, Context } from 'telegraf';
import { Markup } from 'telegraf';
import { DealService } from '../deal/deal.service';
import { UserService } from '../user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { DealType, Currency, DealStatus } from '../deal/enums/deal.enum';
import { User } from '../user/entities/user.entity';

interface DealCreationState {
  step: 'type' | 'amount' | 'description' | 'terms' | 'confirm';
  type?: DealType;
  amount?: number;
  description?: string;
  terms?: string;
}

interface TelegramContextWithState extends Context {
  session?: {
    dealCreation?: DealCreationState;
  };
  state: {
    user?: User;
  };
}

@Injectable()
export class TelegramDealHandler implements OnModuleInit {
  private readonly logger = new Logger(TelegramDealHandler.name);
  private readonly commissionRate = 0.05; // 5%

  constructor(
    private dealService: DealService,
    private userService: UserService,
    private i18nService: I18nService,
  ) {}

  onModuleInit(): void {
    // Обработчики будут зарегистрированы в TelegramBotService
    this.logger.log('Deal handler initialized');
  }

  registerHandlers(bot: Telegraf<TelegramContextWithState>): void {
    // Команда /new_deal
    bot.command('new_deal', async (ctx) => {
      try {
        const user = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        // Инициализация состояния
        ctx.session = ctx.session || {};
        ctx.session.dealCreation = {
          step: 'type',
        };

        const keyboard = this.getTypeKeyboard(lang);

        await ctx.reply(
          `${t('deal.create_title')}\n\n${t('deal.select_type')}`,
          {
            reply_markup: keyboard,
          },
        );
      } catch (error) {
        this.logger.error('new_deal command error', error);
        await ctx.reply(this.i18nService.translate('errors.generic', { lang: 'ru' }));
      }
    });

    // Обработчик выбора типа сделки
    bot.action(/deals_type_(physical|digital|service|rent)/, async (ctx) => {
      try {
        const user = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const type = ctx.match[1] as DealType;

        // Сохраняем тип в состоянии
        if (!ctx.session) ctx.session = {};
        ctx.session.dealCreation = {
          step: 'amount',
          type,
        };

        await ctx.editMessageText(
          `${t('deal.create_title')}: ${t(`deal.types.${type}`)}\n\n` +
            `${t('deal.enter_amount')}\n\n` +
            `ℹ️ ${t('payment.commission')}: 5%\n` +
            `${t('deal.details.seller_receives')}: 100%`,
        );

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('deal type selection error', error);
      }
    });

    // Обработчик команды /my_deals
    bot.command('my_deals', async (ctx) => {
      try {
        const user = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        await ctx.reply(t('menu.my_deals') + '...\n\n' + t('common.loading'));

        const stats = await this.dealService.getUserStats(user.id);

        const message = `
${t('menu.my_deals')}

📊 ${t('deal.details.status')}
├─ ${t('deal.progress.step_6')}: ${stats.completedDeals}
├─ 🔄 ${t('deal.progress.step_3')}: ${stats.activeDeals}
└─ 📈 ${t('profile.deals_count')}: ${stats.totalDeals}

💰 ${t('deal.details.total')}: ${stats.totalAmount} ₽
        `.trim();

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback('📝 Активные', 'deals_filter_active')],
          [Markup.button.callback('✅ Завершённые', 'deals_filter_completed')],
          [Markup.button.callback('📋 Все', 'deals_filter_all')],
        ]);

        await ctx.reply(message, {
          reply_markup: keyboard as any,
        });
      } catch (error) {
        this.logger.error('my_deals command error', error);
      }
    });

    // Обработчик сообщения с суммой
    bot.hears(/^\d+(\.\d{1,2})?$/, async (ctx) => {
      try {
        const session = (ctx as any).session?.dealCreation;

        if (!session || session.step !== 'amount') {
          return;
        }

        const user = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const amount = parseFloat(ctx.message.text);

        if (amount <= 0) {
          await ctx.reply(t('validation.invalid_amount'));
          return;
        }

        // Сохраняем сумму
        session.amount = amount;
        session.step = 'description';

        const commission = amount * this.commissionRate;
        const total = amount + commission;

        await ctx.reply(
          `💰 ${t('deal.details.amount')} ${amount} ₽\n` +
            `📊 ${t('payment.commission')} (${this.commissionRate * 100}%): ${commission.toFixed(2)} ₽\n` +
            `💳 ${t('deal.details.total')} ${total.toFixed(2)} ₽\n\n` +
            `${t('deal.enter_description')}\n\n` +
            `ℹ️ Опишите товар/услугу подробно`,
        );
      } catch (error) {
        this.logger.error('amount message error', error);
      }
    });

    // Обработчик описания сделки
    bot.hears(/.+/, async (ctx) => {
      try {
        const session = ctx.session?.dealCreation;

        if (!session || session.step !== 'description') {
          return;
        }

        const user = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const description = ctx.message.text;

        if (description.length < 10) {
          await ctx.reply('❌ Описание слишком короткое (минимум 10 символов)');
          return;
        }

        // Сохраняем описание
        session.description = description;

        // Создаём сделку
        const deal = await this.dealService.create(
          {
            type: session.type!,
            amount: session.amount!,
            currency: Currency.RUB,
            description: session.description,
            title: `${t(`deal.types.${session.type}`)} - ${session.amount} ₽`,
          },
          user,
        );

        // Очищаем состояние
        delete (ctx as any).session.dealCreation;

        const dealDetails = this.formatDealDetails(deal, lang, t);

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(t('deal.actions.invite'), `deal_invite_${deal.id}`)],
          [Markup.button.callback(t('menu.back_to_menu'), 'menu_back')],
        ]);

        await ctx.reply(
          `✅ ${t('deal.create_title')}\n\n${dealDetails}`,
          {
            reply_markup: keyboard as any,
            parse_mode: 'HTML',
          },
        );

        this.logger.log(`Deal created via Telegram: ${deal.id}`);
      } catch (error) {
        this.logger.error('description message error', error);
        await ctx.reply(this.i18nService.translate('errors.generic', { lang: 'ru' }));
      }
    });
  }

  private getTypeKeyboard(lang: string): any {
    const t = this.i18nService.t(lang);

    return Markup.inlineKeyboard([
      [Markup.button.callback(t('deal.types.physical'), 'deals_type_physical')],
      [Markup.button.callback(t('deal.types.digital'), 'deals_type_digital')],
      [Markup.button.callback(t('deal.types.service'), 'deals_type_service')],
      [Markup.button.callback(t('deal.types.rent'), 'deals_type_rent')],
      [Markup.button.callback(t('common.cancel'), 'menu_back')],
    ]);
  }

  private formatDealDetails(deal: any, lang: string, t: any): string {
    const statusEmoji: Record<DealStatus, string> = {
      [DealStatus.DRAFT]: '📝',
      [DealStatus.PENDING_ACCEPTANCE]: '⏳',
      [DealStatus.PENDING_PAYMENT]: '💳',
      [DealStatus.IN_PROGRESS]: '🔄',
      [DealStatus.PENDING_CONFIRMATION]: '✅',
      [DealStatus.COMPLETED]: '✅',
      [DealStatus.CANCELLED]: '❌',
      [DealStatus.REFUNDED]: '💰',
      [DealStatus.DISPUTED]: '⚖️',
      [DealStatus.DISPUTE_RESOLVED]: '✅',
      [DealStatus.FROZEN]: '❄️',
    };

    return `
${t('deal.details.number')} <code>${deal.dealNumber}</code>
${t('deal.details.type')} ${t(`deal.types.${deal.type}`)}
${t('deal.details.status')} ${statusEmoji[deal.status as keyof typeof statusEmoji] || ''} ${t(`deal.status.${deal.status}` as any) || ''}

${t('deal.details.amount')} ${deal.amount} ${deal.currency}
${t('payment.commission')} ${deal.commissionAmount} ${deal.currency}
${t('deal.details.total')} ${deal.buyerPays} ${deal.currency}

${t('deal.details.description')}
${deal.description}
    `.trim();
  }

  async sendDealNotification(
    userId: string,
    dealId: string,
    notificationType: 'created' | 'accepted' | 'payment' | 'completed' | 'dispute',
  ): Promise<void> {
    try {
      const user = await this.userService.findById(userId);

      if (!user?.telegramId) {
        return;
      }

      const lang = await this.userService.getUserLanguage(userId);
      const t = this.i18nService.t(lang);

      const deal = await this.dealService.findById(dealId);

      const messages: Record<typeof notificationType, string> = {
        created: `📬 ${t('notifications.new_deal')}\n${t('deal.details.number')} ${deal.dealNumber}`,
        accepted: `✅ Сделка ${deal.dealNumber} принята`,
        payment: `💰 ${t('notifications.payment_received')}\n${t('deal.details.number')} ${deal.dealNumber}`,
        completed: `✅ ${t('notifications.deal_completed')}\n${t('deal.details.number')} ${deal.dealNumber}`,
        dispute: `⚖️ ${t('notifications.dispute_opened')}\n${t('deal.details.number')} ${deal.dealNumber}`,
      };

      // Отправка через bot будет реализована в TelegramBotService
      this.logger.log(`Notification ${notificationType} for deal ${dealId}`);
    } catch (error) {
      this.logger.error('sendDealNotification error', error);
    }
  }
}
