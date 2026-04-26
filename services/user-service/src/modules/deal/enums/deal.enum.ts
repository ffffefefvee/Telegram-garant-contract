/**
 * Типы сделок в системе гарантийных платежей
 */
export enum DealType {
  /** Физические товары (доставка, самовывоз) */
  PHYSICAL = 'physical',
  
  /** Цифровые товары (ключи, аккаунты, файлы) */
  DIGITAL = 'digital',
  
  /** Услуги (разработка, дизайн, консультации) */
  SERVICE = 'service',
  
  /** Аренда (помещения, оборудование, транспорт) */
  RENT = 'rent',
}

/**
 * Статусы сделки в течение жизненного цикла
 */
export enum DealStatus {
  /** Черновик - сделка создаётся */
  DRAFT = 'draft',
  
  /** Ожидание принятия контрагентом */
  PENDING_ACCEPTANCE = 'pending_acceptance',
  
  /** Ожидание оплаты от покупателя */
  PENDING_PAYMENT = 'pending_payment',
  
  /** Оплата в эскроу, ожидание выполнения */
  IN_PROGRESS = 'in_progress',
  
  /** Ожидание подтверждения получения */
  PENDING_CONFIRMATION = 'pending_confirmation',
  
  /** Сделка успешно завершена */
  COMPLETED = 'completed',
  
  /** Сделка отменена (до оплаты) */
  CANCELLED = 'cancelled',
  
  /** Сделка возвращена (после оплаты) */
  REFUNDED = 'refunded',
  
  /** Открыт спор */
  DISPUTED = 'disputed',
  
  /** Спор решён */
  DISPUTE_RESOLVED = 'dispute_resolved',
  
  /** Сделка заморожена арбитром */
  FROZEN = 'frozen',
}

/**
 * Стороны сделки
 */
export enum DealSide {
  /** Покупатель - платит деньги */
  BUYER = 'buyer',
  
  /** Продавец - получает деньги */
  SELLER = 'seller',
}

/**
 * Типы вложений к сообщениям сделки
 */
export enum AttachmentType {
  /** Изображение */
  IMAGE = 'image',
  
  /** Документ */
  DOCUMENT = 'document',
  
  /** Видео */
  VIDEO = 'video',
  
  /** Аудио */
  AUDIO = 'audio',
  
  /** Ссылка */
  LINK = 'link',
  
  /** Голосовое сообщение */
  VOICE = 'voice',
}

/**
 * Типы событий в сделке
 */
export enum DealEventType {
  /** Сделка создана */
  DEAL_CREATED = 'deal_created',
  
  /** Контрагент приглашён */
  COUNTERPARTY_INVITED = 'counterparty_invited',
  
  /** Контрагент принял сделку */
  COUNTERPARTY_ACCEPTED = 'counterparty_accepted',
  
  /** Контрагент отклонил сделку */
  COUNTERPARTY_REJECTED = 'counterparty_rejected',
  
  /** Оплата внесена */
  PAYMENT_RECEIVED = 'payment_received',
  
  /** Продавец начал выполнение */
  SELLER_STARTED = 'seller_started',
  
  /** Покупатель подтвердил получение */
  BUYER_CONFIRMED = 'buyer_confirmed',
  
  /** Покупатель отклонил получение */
  BUYER_REJECTED = 'buyer_rejected',
  
  /** Открыт спор */
  DISPUTE_OPENED = 'dispute_opened',
  
  /** Спор решён */
  DISPUTE_RESOLVED = 'dispute_resolved',
  
  /** Сделка отменена */
  DEAL_CANCELLED = 'deal_cancelled',
  
  /** Сделка возвращена */
  DEAL_REFUNDED = 'deal_refunded',
  
  /** Сообщение отправлено */
  MESSAGE_SENT = 'message_sent',
  
  /** Вложение добавлено */
  ATTACHMENT_ADDED = 'attachment_added',
}

/**
 * Валюты для сделок
 */
export enum Currency {
  RUB = 'RUB',
  USD = 'USD',
  EUR = 'EUR',
  TON = 'TON',
  USDT = 'USDT',
  BTC = 'BTC',
}
