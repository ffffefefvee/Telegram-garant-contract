import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { TelegramBotService } from './telegram-bot.service';
import { UserService } from '../user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { LanguageCode } from '../user/entities/language-preference.entity';
import { User } from '../user/entities/user.entity';

@Injectable()
export class TelegramCallbackHandler implements OnModuleInit {
  private readonly logger = new Logger(TelegramCallbackHandler.name);

  constructor(
    private botService: TelegramBotService,
    private userService: UserService,
    private i18nService: I18nService,
  ) {}

  onModuleInit(): void {
    const bot = this.botService.getBot();

    if (!bot) {
      return;
    }

    this.setupCallbackHandlers(bot);
    this.logger.log('Callback handlers registered');
  }

  private setupCallbackHandlers(bot: any): void {
    bot.action('menu_back', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const keyboard = this.getMainMenuKeyboard(lang);

        await ctx.editMessageText(t('bot.menu_title'), {
          reply_markup: keyboard,
        });
      } catch (error) {
        this.logger.error('menu_back error', error);
      }
    });

    bot.action('settings_language', async (ctx: any) => {
      try {
        const keyboard = this.getLanguageKeyboard();

        await ctx.editMessageText(
          this.i18nService.translate('common.select_language', { lang: 'ru' }),
          {
            reply_markup: keyboard,
          },
        );
      } catch (error) {
        this.logger.error('settings_language error', error);
      }
    });

    bot.action('lang_ru', async (ctx: any) => {
      await this.handleLanguageChange(ctx, LanguageCode.RU);
    });

    bot.action('lang_en', async (ctx: any) => {
      await this.handleLanguageChange(ctx, LanguageCode.EN);
    });

    bot.action('lang_es', async (ctx: any) => {
      await this.handleLanguageChange(ctx, LanguageCode.ES);
    });

    bot.action('help', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const message = t('bot.help_message');

        await ctx.reply(message, {
          parse_mode: 'HTML',
        });

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('help error', error);
      }
    });

    bot.action('support', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';

        await ctx.reply(
          this.i18nService.translate('common.contact', { lang }) + ': @support',
        );

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('support error', error);
      }
    });

    bot.action('balance', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const message = `
${t('payment.title')}

${t('payment.amount')} ${user.balance} ₽
        `.trim();

        await ctx.reply(message);
        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('balance error', error);
      }
    });

    bot.action('profile', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const stats = await this.userService.getUserStats(user.id);

        const message = `
${t('profile.title')}

${t('profile.name')} ${user.fullName || '-'}
${t('profile.username')} ${user.telegramUsername || '-'}
${t('profile.balance')} ${user.balance} ₽
${t('profile.reputation')} ${user.reputationScore}/100
${t('profile.deals_count')} ${stats.totalDeals}
${t('profile.member_since')} ${new Date(user.createdAt).toLocaleDateString(lang)}
        `.trim();

        await ctx.reply(message);
        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('profile error', error);
      }
    });

    bot.action('deal_create', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const keyboard = this.getDealTypeKeyboard(lang);

        await ctx.reply(t('deal.select_type'), {
          reply_markup: keyboard,
        });

        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('deal_create error', error);
      }
    });

    bot.action('deals_list', async (ctx: any) => {
      try {
        const user: User = ctx.state.user;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        await ctx.reply(t('menu.my_deals') + ' - ' + t('common.loading'));
        await ctx.answerCbQuery();
      } catch (error) {
        this.logger.error('deals_list error', error);
      }
    });

    bot.action('deals_type_physical', async (ctx: any) => {
      await this.handleDealTypeSelected(ctx, 'physical');
    });

    bot.action('deals_type_digital', async (ctx: any) => {
      await this.handleDealTypeSelected(ctx, 'digital');
    });

    bot.action('deals_type_service', async (ctx: any) => {
      await this.handleDealTypeSelected(ctx, 'service');
    });

    bot.action('deals_type_rent', async (ctx: any) => {
      await this.handleDealTypeSelected(ctx, 'rent');
    });
  }

  private async handleLanguageChange(ctx: any, languageCode: LanguageCode): Promise<void> {
    try {
      const user: User = ctx.state.user;

      await this.userService.setUserLanguage(user.id, languageCode);

      const langNames: Record<LanguageCode, string> = {
        [LanguageCode.RU]: 'Русский',
        [LanguageCode.EN]: 'English',
        [LanguageCode.ES]: 'Español',
      };

      const t = this.i18nService.t(languageCode);

      await ctx.editMessageText(
        `${t('common.success')}: ${langNames[languageCode]}`,
        {
          reply_markup: this.getMainMenuKeyboard(languageCode),
        },
      );

      await ctx.answerCbQuery(t('common.language_changed'));
    } catch (error) {
      this.logger.error('handleLanguageChange error', error);
      await ctx.answerCbQuery(this.i18nService.translate('errors.generic', { lang: 'ru' }));
    }
  }

  private async handleDealTypeSelected(ctx: any, dealType: string): Promise<void> {
    try {
      const user: User = ctx.state.user;
      const lang = user?.telegramLanguageCode || 'ru';
      const t = this.i18nService.t(lang);

      await ctx.reply(
        `${t('deal.create_title')}: ${t(`deal.types.${dealType}`)}\n\n` +
          t('deal.enter_amount'),
      );

      await ctx.answerCbQuery();
    } catch (error) {
      this.logger.error('handleDealTypeSelected error', error);
    }
  }

  private getMainMenuKeyboard(lang: string): any {
    const t = this.i18nService.t(lang);

    return {
      inline_keyboard: [
        [
          { text: t('menu.new_deal'), callback_data: 'deal_create' },
          { text: t('menu.my_deals'), callback_data: 'deals_list' },
        ],
        [
          { text: t('menu.balance'), callback_data: 'balance' },
          { text: t('menu.profile'), callback_data: 'profile' },
        ],
        [
          { text: t('menu.language'), callback_data: 'settings_language' },
          { text: t('menu.help'), callback_data: 'help' },
        ],
        [{ text: t('menu.support'), callback_data: 'support' }],
      ],
    };
  }

  private getDealTypeKeyboard(lang: string): any {
    const t = this.i18nService.t(lang);

    return {
      inline_keyboard: [
        [{ text: t('deal.types.physical'), callback_data: 'deals_type_physical' }],
        [{ text: t('deal.types.digital'), callback_data: 'deals_type_digital' }],
        [{ text: t('deal.types.service'), callback_data: 'deals_type_service' }],
        [{ text: t('deal.types.rent'), callback_data: 'deals_type_rent' }],
        [{ text: t('common.back'), callback_data: 'menu_back' }],
      ],
    };
  }

  private getLanguageKeyboard(): any {
    return {
      inline_keyboard: [
        [
          { text: '🇷🇺 Русский', callback_data: 'lang_ru' },
          { text: '🇬🇧 English', callback_data: 'lang_en' },
          { text: '🇪🇸 Español', callback_data: 'lang_es' },
        ],
      ],
    };
  }
}
