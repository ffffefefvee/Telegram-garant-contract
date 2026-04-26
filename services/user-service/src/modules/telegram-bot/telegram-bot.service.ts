import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Context, Markup } from 'telegraf';
import { UserService } from '../user/user.service';
import { I18nService } from '../i18n/i18n.service';
import { LanguagePreference, LanguageCode } from '../user/entities/language-preference.entity';
import { User } from '../user/entities/user.entity';
import { TelegramDealHandler } from './telegram-deal.handler';
import { InlineKeyboardMarkup, ReplyKeyboardMarkup } from 'telegraf/typings/core/types/typegram';

export interface TelegramContext extends Context {
  session?: {
    state?: string;
    data?: any;
    dealCreation?: any;
  };
}

@Injectable()
export class TelegramBotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelegramBotService.name);
  private bot: Telegraf<TelegramContext>;
  private readonly isProduction: boolean;

  constructor(
    private configService: ConfigService,
    private userService: UserService,
    private i18nService: I18nService,
    private dealHandler: TelegramDealHandler,
  ) {
    this.isProduction = this.configService.get('NODE_ENV') === 'production';
    const token = this.configService.get('TELEGRAM_BOT_TOKEN');

    if (!token) {
      this.logger.warn('TELEGRAM_BOT_TOKEN not provided. Bot will not start.');
      return;
    }

    this.bot = new Telegraf<TelegramContext>(token);

    this.setupBot();
  }

  async onModuleInit(): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      const botInfo = await this.bot.telegram.getMe();
      this.logger.log(`Bot initialized: @${botInfo.username}`);

      await this.bot.launch({
        dropPendingUpdates: !this.isProduction,
      });

      this.logger.log('Bot started successfully');
    } catch (error) {
      this.logger.error('Failed to start bot', error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.bot) {
      await this.bot.stop('Bot service destroyed');
      this.logger.log('Bot stopped');
    }
  }

  private setupBot(): void {
    this.setupMiddleware();
    this.setupCommands();
    this.setupErrorHandler();
    
    // Регистрируем обработчики сделок
    if (this.bot) {
      this.dealHandler.registerHandlers(this.bot);
    }
  }

  private setupMiddleware(): void {
    this.bot.use(async (ctx, next) => {
      if (ctx.from?.is_bot) {
        return;
      }

      const now = Date.now();

      try {
        await next();
      } catch (error) {
        this.logger.error('Middleware error', error);
      }

      this.logger.debug(
        `Request from ${ctx.from?.username || ctx.from?.id}: ${ctx.updateType}`,
      );
    });

    this.bot.use(async (ctx, next) => {
      if (!ctx.from) {
        this.logger.warn('No from field in update');
        return;
      }

      try {
        this.logger.debug(`Updating user ${ctx.from.id} (@${ctx.from.username})`);
        const user = await this.userService.updateTelegramUser(
          ctx.from.id,
          ctx.from.username,
          ctx.from.first_name,
          ctx.from.last_name,
          ctx.from.language_code,
        );

        (ctx as any).state.user = user;
        this.logger.debug(`User updated: ${user.id}`);
      } catch (error) {
        this.logger.error('Failed to update user', error);
      }

      await next();
    });
  }

  private setupCommands(): void {
    this.bot.start(async (ctx) => {
      this.logger.log(`Start command received from ${ctx.from?.username || ctx.from?.id}`);
      try {
        const user = (ctx as any).state.user as User | undefined;
        const lang = user?.telegramLanguageCode || 'ru';
        const translator = this.i18nService.t(lang);

        const message = translator('bot.start_message');

        this.logger.debug(`Sending start message to user ${ctx.from?.id}, lang: ${lang}`);

        await ctx.reply(message, {
          parse_mode: 'HTML',
        });

        this.logger.log(`Start message sent to ${ctx.from?.id}`);
      } catch (error) {
        this.logger.error('Start command error', error);
        try {
          await ctx.reply('Welcome to Garant Bot! Use /menu for main menu.');
        } catch (replyError) {
          this.logger.error('Failed to send fallback message', replyError);
        }
      }
    });

    this.bot.command('menu', async (ctx) => {
      try {
        const user = (ctx as any).state.user as User;
        const lang = user?.telegramLanguageCode || 'ru';
        const translator = this.i18nService.t(lang);

        const keyboard = this.getMainMenuKeyboard(lang);

        await ctx.reply(translator('bot.menu_title'), {
          reply_markup: keyboard as any,
        });
      } catch (error) {
        this.logger.error('Menu command error', error);
      }
    });

    this.bot.command('help', async (ctx) => {
      try {
        const user = (ctx as any).state.user as User;
        const lang = user?.telegramLanguageCode || 'ru';
        const translator = this.i18nService.t(lang);

        const message = translator('bot.help_message');

        await ctx.reply(message, {
          parse_mode: 'HTML',
        });
      } catch (error) {
        this.logger.error('Help command error', error);
      }
    });

    this.bot.command('language', async (ctx) => {
      try {
        const user = (ctx as any).state.user as User;
        const keyboard = this.getLanguageKeyboard();

        await ctx.reply(
          this.i18nService.translate('common.select_language', { lang: user?.telegramLanguageCode || 'ru' }),
          {
            reply_markup: keyboard as any,
          },
        );
      } catch (error) {
        this.logger.error('Language command error', error);
      }
    });

    this.bot.command('settings', async (ctx) => {
      try {
        const user = (ctx as any).state.user as User;
        const lang = user?.telegramLanguageCode || 'ru';
        const t = this.i18nService.t(lang);

        const keyboard = Markup.inlineKeyboard([
          [Markup.button.callback(t('menu.language'), 'settings_language')],
          [Markup.button.callback(t('menu.back_to_menu'), 'menu_back')],
        ]);

        await ctx.reply(t('menu.settings'), {
          reply_markup: keyboard as any,
        });
      } catch (error) {
        this.logger.error('Settings command error', error);
      }
    });

    this.bot.command('profile', async (ctx) => {
      try {
        const user = (ctx as any).state.user as User;
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
      } catch (error) {
        this.logger.error('Profile command error', error);
      }
    });
  }

  private setupErrorHandler(): void {
    this.bot.catch((error: any, ctx) => {
      this.logger.error(`Telegram error: ${error?.message || error}`, error);

      if (ctx && 'reply' in ctx) {
        ctx.reply(this.i18nService.translate('errors.generic', { lang: 'ru' }));
      }
    });
  }

  private getMainMenuKeyboard(lang: string) {
    const t = this.i18nService.getTranslator(lang);

    return Markup.inlineKeyboard([
      [
        Markup.button.callback(t('menu.new_deal'), 'deal_create'),
        Markup.button.callback(t('menu.my_deals'), 'deals_list'),
      ],
      [
        Markup.button.callback(t('menu.balance'), 'balance'),
        Markup.button.callback(t('menu.profile'), 'profile'),
      ],
      [
        Markup.button.callback(t('menu.language'), 'settings_language'),
        Markup.button.callback(t('menu.help'), 'help'),
      ],
      [
        Markup.button.callback(t('menu.support'), 'support'),
      ],
    ]);
  }

  private getLanguageKeyboard() {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🇷🇺 Русский', 'lang_ru'),
        Markup.button.callback('🇬🇧 English', 'lang_en'),
        Markup.button.callback('🇪🇸 Español', 'lang_es'),
      ],
    ]);
  }

  getBot(): Telegraf<TelegramContext> | null {
    return this.bot;
  }

  async sendMessage(
    chatId: number,
    message: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyMarkup?: any;
    },
  ): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.telegram.sendMessage(chatId, message, {
        parse_mode: options?.parseMode as any,
        reply_markup: options?.replyMarkup,
      });
    } catch (error) {
      this.logger.error(`Failed to send message to ${chatId}`, error);
    }
  }

  async editMessage(
    chatId: number,
    messageId: number,
    message: string,
    options?: {
      parseMode?: 'HTML' | 'Markdown';
      replyMarkup?: any;
    },
  ): Promise<void> {
    if (!this.bot) {
      return;
    }

    try {
      await this.bot.telegram.editMessageText(chatId, messageId, undefined, message, {
        parse_mode: options?.parseMode as any,
        reply_markup: options?.replyMarkup,
      });
    } catch (error) {
      this.logger.error(`Failed to edit message ${messageId}`, error);
    }
  }

  async sendNotification(
    userId: string,
    notificationKey: string,
    data?: Record<string, any>,
  ): Promise<void> {
    const user = await this.userService.findById(userId);

    if (!user?.telegramId) {
      return;
    }

    const lang = await this.userService.getUserLanguage(userId);
    const message = this.i18nService.translate(`notifications.${notificationKey}`, { lang });

    await this.sendMessage(user.telegramId, message);
  }
}
