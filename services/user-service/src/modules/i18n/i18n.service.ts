import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LanguageCode } from '../user/entities/language-preference.entity';

export type TranslatorFunction = (key: string) => string;

@Injectable()
export class I18nService implements OnModuleInit {
  private readonly logger = new Logger(I18nService.name);
  private currentLang: LanguageCode = LanguageCode.RU;
  private readonly supportedLanguages: LanguageCode[] = [
    LanguageCode.RU,
    LanguageCode.EN,
    LanguageCode.ES,
  ];

  private readonly translations: Record<string, Record<string, string>> = {
    ru: {
      'bot.start_message': 'Добро пожаловать в Гарант Бот!',
      'bot.menu_title': 'Главное меню',
      'menu.new_deal': 'Новая сделка',
      'menu.my_deals': 'Мои сделки',
      'menu.balance': 'Баланс',
      'menu.profile': 'Профиль',
      'menu.language': 'Язык',
      'menu.help': 'Помощь',
      'menu.support': 'Поддержка',
      'menu.settings': 'Настройки',
      'menu.back_to_menu': 'Назад в меню',
      'common.back': 'Назад',
      'common.cancel': 'Отмена',
      'common.loading': 'Загрузка...',
      'common.success': 'Успешно',
      'common.language_changed': 'Язык изменён',
      'deal.create_title': 'Создание сделки',
      'deal.select_type': 'Выберите тип сделки:',
      'deal.enter_amount': 'Введите сумму:',
      'deal.enter_description': 'Опишите детали:',
      'deal.create_success': 'Сделка создана!',
      'deal.details.status': 'Статус',
      'deal.details.amount': 'Сумма',
      'deal.details.total': 'Итого',
      'deal.details.number': 'Номер',
      'deal.details.seller_receives': 'Продавец получает',
      'deal.actions.invite': 'Пригласить',
      'deal.types.physical': 'Товар',
      'deal.types.digital': 'Цифровой товар',
      'deal.types.service': 'Услуга',
      'deal.types.rent': 'Аренда',
      'deal.progress.step_6': 'Завершено',
      'deal.progress.step_3': 'В процессе',
      'payment.title': 'Баланс',
      'payment.amount': 'Текущий баланс',
      'payment.commission': 'Комиссия',
      'profile.title': 'Профиль',
      'profile.name': 'Имя',
      'profile.username': 'Telegram',
      'profile.balance': 'Баланс',
      'profile.reputation': 'Репутация',
      'profile.deals_count': 'Сделок',
      'profile.member_since': 'Участник с',
      'validation.invalid_amount': 'Неверная сумма',
      'notifications.new_deal': 'Новая сделка',
      'notifications.payment_received': 'Оплата получена',
      'notifications.deal_completed': 'Сделка завершена',
      'notifications.dispute_opened': 'Открыт спор',
      'errors.generic': 'Произошла ошибка',
    },
    en: {
      'bot.start_message': 'Welcome to Garant Bot!',
      'bot.menu_title': 'Main menu',
      'menu.new_deal': 'New deal',
      'menu.my_deals': 'My deals',
      'menu.balance': 'Balance',
      'menu.profile': 'Profile',
      'menu.language': 'Language',
      'menu.help': 'Help',
      'menu.support': 'Support',
      'menu.settings': 'Settings',
      'menu.back_to_menu': 'Back to menu',
      'common.back': 'Back',
      'common.cancel': 'Cancel',
      'common.loading': 'Loading...',
      'common.success': 'Success',
      'common.language_changed': 'Language changed',
      'deal.create_title': 'Create deal',
      'deal.select_type': 'Select deal type:',
      'deal.enter_amount': 'Enter amount:',
      'deal.enter_description': 'Describe the deal:',
      'deal.create_success': 'Deal created!',
      'deal.details.status': 'Status',
      'deal.details.amount': 'Amount',
      'deal.details.total': 'Total',
      'deal.details.number': 'Number',
      'deal.details.seller_receives': 'Seller receives',
      'deal.actions.invite': 'Invite',
      'deal.types.physical': 'Physical',
      'deal.types.digital': 'Digital',
      'deal.types.service': 'Service',
      'deal.types.rent': 'Rent',
      'deal.progress.step_6': 'Completed',
      'deal.progress.step_3': 'In progress',
      'payment.title': 'Balance',
      'payment.amount': 'Current balance',
      'payment.commission': 'Commission',
      'profile.title': 'Profile',
      'profile.name': 'Name',
      'profile.username': 'Telegram',
      'profile.balance': 'Balance',
      'profile.reputation': 'Reputation',
      'profile.deals_count': 'Deals',
      'profile.member_since': 'Member since',
      'validation.invalid_amount': 'Invalid amount',
      'notifications.new_deal': 'New deal',
      'notifications.payment_received': 'Payment received',
      'notifications.deal_completed': 'Deal completed',
      'notifications.dispute_opened': 'Dispute opened',
      'errors.generic': 'An error occurred',
    },
    es: {
      'bot.start_message': 'Bienvenue a Garant Bot!',
      'bot.menu_title': 'Menu principal',
      'menu.new_deal': 'Nuevo trato',
      'menu.my_deals': 'Mis tratos',
      'menu.balance': 'Balance',
      'menu.profile': 'Perfil',
      'menu.language': 'Idioma',
      'menu.help': 'Ayuda',
      'menu.support': 'Soporte',
      'menu.settings': 'Ajustes',
      'menu.back_to_menu': 'Volver al menu',
      'common.back': 'Volver',
      'common.cancel': 'Cancelar',
      'common.loading': 'Cargando...',
      'common.success': 'Exito',
      'common.language_changed': 'Idioma cambiado',
      'deal.create_title': 'Crear trato',
      'deal.select_type': 'Selecciona tipo:',
      'deal.enter_amount': 'Ingresa cantidad:',
      'deal.enter_description': 'Describe detalles:',
      'deal.create_success': 'Trato creado!',
      'deal.details.status': 'Estado',
      'deal.details.amount': 'Cantidad',
      'deal.details.total': 'Total',
      'deal.details.number': 'Numero',
      'deal.details.seller_receives': 'Vendedor recibe',
      'deal.actions.invite': 'Invitar',
      'deal.types.physical': 'Fisico',
      'deal.types.digital': 'Digital',
      'deal.types.service': 'Servicio',
      'deal.types.rent': 'Alquiler',
      'deal.progress.step_6': 'Completado',
      'deal.progress.step_3': 'En proceso',
      'payment.title': 'Balance',
      'payment.amount': 'Balance actual',
      'payment.commission': 'Comision',
      'profile.title': 'Perfil',
      'profile.name': 'Nombre',
      'profile.username': 'Telegram',
      'profile.balance': 'Balance',
      'profile.reputation': 'Reputacion',
      'profile.deals_count': 'Tratos',
      'profile.member_since': 'Miembro desde',
      'validation.invalid_amount': 'Cantidad invalida',
      'notifications.new_deal': 'Nuevo trato',
      'notifications.payment_received': 'Pago recibido',
      'notifications.deal_completed': 'Trato completado',
      'notifications.dispute_opened': 'Disputa abierta',
      'errors.generic': 'Ocurrio un error',
    },
  };

  constructor(private configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    this.logger.log('I18n service initialized');
  }

  t(lang: string): TranslatorFunction {
    return (key: string) => this.translateKey(key, lang);
  }

  private translateKey(key: string, lang: string): string {
    const langCode = (lang || 'ru') as string;
    return this.translations[langCode]?.[key] || this.translations['ru']?.[key] || key;
  }

  translate(key: string, options?: { lang?: string }): string {
    const lang = options?.lang || this.currentLang;
    return this.translateKey(key, lang);
  }

  async changeLanguage(lang: LanguageCode): Promise<void> {
    this.currentLang = lang;
  }

  setLanguage(lang: LanguageCode): void {
    this.currentLang = lang;
  }

  getLanguage(): LanguageCode {
    return this.currentLang;
  }

  getSupportedLanguages(): LanguageCode[] {
    return this.supportedLanguages;
  }

  getTranslator(lang: LanguageCode | string): TranslatorFunction {
    return (key: string) => this.translateKey(key, lang);
  }

  async reloadTranslations(): Promise<void> {
    this.logger.log('Translations reloaded');
  }
}