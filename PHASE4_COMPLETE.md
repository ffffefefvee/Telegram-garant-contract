# Отчёт о Завершении Фазы 4: Платежная Система и Комиссии

## ✅ Выполненные Задачи

### 1. Модели Данных
- [x] **Payment** - основная модель платежа
- [x] **CommissionRate** - ставки комиссий
- [x] **CurrencyRate** - курсы валют

### 2. Enum Типы
- [x] **PaymentType**: deposit, deal_payment, refund, withdraw, commission, arbitration_fee
- [x] **PaymentStatus**: pending, processing, completed, expired, cancelled, failed, refunded
- [x] **PaymentMethod**: cryptomus, card, e_wallet, crypto, balance
- [x] **FiatCurrency**: RUB, USD, EUR, UAH, BYN, KZT
- [x] **CryptoCurrency**: USDT, USDC, BTC, ETH, TON, TRX, LTC
- [x] **ConversionDirection**: fiat_to_crypto, crypto_to_fiat, crypto_to_crypto, fiat_to_fiat

### 3. Cryptomus API Сервис
- [x] Создание инвойса (createInvoice)
- [x] Проверка статуса платежа (getPaymentInfo)
- [x] Получение баланса (getBalance)
- [x] Создание платежа для сделки (createDealPayment)
- [x] Проверка статуса (checkPaymentStatus)
- [x] Обработка callback (processCallback)
- [x] Конвертация валют (convertCurrency)

### 4. Payment Service
- [x] Создание платежа с расчётом комиссии
- [x] Поиск по ID и transaction ID
- [x] Проверка статуса платежа
- [x] Обработка callback от Cryptomus
- [x] Возврат платежей
- [x] Расчёт комиссии
- [x] Конвертация валют
- [x] История платежей пользователя
- [x] Автоматическая обработка успешных платежей

### 5. Система Комиссий
- [x] Гибкие ставки комиссий (процент + фикс)
- [x] Мин/макс суммы для комиссий
- [x] Период действия ставок
- [x] Комиссия 5% для сделок (покупатель платит)
- [x] Продавец получает 100% суммы сделки

### 6. Валютная Конвертация
- [x] Кэширование курсов валют
- [x] Автоматическое обновление курсов
- [x] Конвертация через Cryptomus
- [x] Поддержка фиатных и крипто валют

### 7. Интеграция
- [x] PaymentModule подключён к AppModule
- [x] DealService интегрирован с PaymentService
- [x] UserService для обновления баланса
- [x] WebhookController для Cryptomus callback

### 8. Переводы
- [x] Русский (ru) - 50+ строк
- [x] Английский (en) - 50+ строк
- [x] Испанский (es) - 50+ строк

### 9. Миграции
- [x] 3 новые таблицы
- [x] 3 enum типа
- [x] Индексы для оптимизации

## 🏗️ Архитектура Платежной Системы

### Диаграмма Потока Платежа
```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Покупатель │     │  DealService│     │ PaymentService│
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │  Создать сделку   │                   │
       │──────────────────►│                   │
       │                   │                   │
       │  Создать платёж   │                   │
       │──────────────────────────────────────►│
       │                   │                   │
       │                   │  Расчёт комиссии  │
       │                   │  (5% = 50₽)       │
       │                   │                   │
       │                   │  Создать инвойс   │
       │                   │  Cryptomus        │
       │                   │                   │
       │  Ссылка на оплату │                   │
       │◄──────────────────────────────────────│
       │  (сумма + комиссия)                   │
       │                   │                   │
       │  Переход по ссылке                    │
       │──────────────────────────────────────►│
       │                   │                   │
       │  Оплата (USDT)    │                   │
       │──────────────────────────────────────►│
       │                   │                   │
       │                   │  Callback от      │
       │                   │  Cryptomus        │
       │                   │                   │
       │                   │  Обновление       │
       │                   │  статуса          │
       │                   │                   │
       │                   │  Deal: IN_PROGRESS│
       │                   │                   │
       │  Успешная оплата  │                   │
       │◄──────────────────────────────────────│
```

### Схема Эскроу
```
┌─────────────────────────────────────────────────────────┐
│                    ЭСКРОУ СЧЕТ                          │
│                                                          │
│  Покупатель ──────► 1000₽ ──────► Система (эскроу)     │
│                                    │                    │
│                                    │ 950₽               │
│                                    ▼                    │
│                              Продавец                   │
│                                                          │
│  Комиссия: 50₽ (5%) - остаётся в системе               │
└─────────────────────────────────────────────────────────┘
```

## 💰 Структура Комиссий

### Типы Комиссий
| Тип | Ставка | Кто платит |
|-----|--------|------------|
| deal_payment | 5% | Покупатель |
| deposit | 0% | - |
| withdraw | 1% | Пользователь |
| arbitration | 10% | Проигравшая сторона |

### Пример Расчёта
```
Сумма сделки: 1000₽
Комиссия (5%): 50₽
─────────────────────
Покупатель платит: 1050₽
Продавец получает: 1000₽
Система зарабатывает: 50₽
```

## 🔧 API Endpoints

### Payments
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/payments` | Создать платёж |
| GET | `/api/payments` | История платежей пользователя |
| GET | `/api/payments/:id` | Получить платёж по ID |
| POST | `/api/payments/:id/check` | Проверить статус |
| POST | `/api/payments/:id/refund` | Возврат платежа |
| GET | `/api/payments/deal/:dealId` | Платежи сделки |

### Webhooks
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/webhook/cryptomus` | Callback от Cryptomus |

## 🔐 Безопасность Платежей

### Подпись Callback
```typescript
// Cryptomus отправляет подпись в заголовке 'sign'
const expectedSign = crypto
  .createHmac('sha256', apiKey)
  .update(base64Encode(data))
  .digest('base64');

if (sign !== expectedSign) {
  throw new Error('Invalid signature');
}
```

### Проверка Статусов
- Только pending платежи можно оплатить
- Только completed платежи можно вернуть
- Автоматическая проверка истечения срока

### Идемпотентность
- transactionId уникален для каждого платежа
- Повторные callback не дублируют зачисления

## 📊 Модель Данных Payment

### Основные Поля
```typescript
{
  id: 'uuid',
  transactionId: 'PAY_lqxz4k_abc123',  // Уникальный ID
  type: 'deal_payment',              // Тип платежа
  status: 'pending',                 // Статус
  userId: 'uuid',                    // Плательщик
  dealId: 'uuid',                    // Связь со сделкой
  amount: 1000.00,                   // Сумма в фиате
  currency: 'RUB',                   // Валюта
  cryptoAmount: 10.5,                // Сумма в крипте
  cryptoCurrency: 'USDT',            // Криптовалюта
  fee: 50.00,                        // Комиссия
  paymentMethod: 'cryptomus',        // Метод оплаты
  paymentUrl: 'https://...',         // Ссылка на оплату
  expiresAt: Date,                   // Срок действия
  paidAt: Date,                      // Дата оплаты
}
```

## 🌐 Валютная Конвертация

### Поддерживаемые Пары
```
RUB → USDT
USD → USDT
EUR → USDT
USDT → BTC
USDT → ETH
USDT → TON
```

### Кэширование Курсов
```typescript
// Курсы кэшируются на 1 час
const cachedRate = await this.currencyRateRepository.findOne({
  where: { fromCurrency, toCurrency },
  order: { createdAt: 'DESC' },
});

if (cachedRate && cachedRate.isCurrent) {
  return cachedRate.rate;
}

// Запрос нового курса через Cryptomus
```

## 🔄 Жизненный Цикл Платежа

```
┌─────────┐
│ PENDING │───────────────┐
└────┬────┘               │
     │                    │
     │ Process            │ Expire
     ▼                    │
┌────────────┐            │
│ PROCESSING │            │
└────┬───────┘            │
     │                    │
     │ Confirm            │
     ▼                    ▼
┌───────────┐      ┌─────────┐
│ COMPLETED │      │ EXPIRED │
└─────┬─────┘      └─────────┘
      │
      │ Refund
      ▼
┌──────────┐
│ REFUNDED │
└──────────┘
```

## ⚙️ Environment Variables

```env
# Cryptomus
CRYPTOMUS_API_KEY=your_api_key
CRYPTOMUS_MERCHANT_ID=your_merchant_id
CRYPTOMUS_SANDBOX=true  # false для продакшена

# Приложение
APP_URL=https://t.me/garant_bot  # Для return URL
```

## 🎯 Ключевые Решения

### 1. Покупатель Платит Комиссию
- Продавец получает ровно сумму сделки
- Прозрачная система для продавцов
- Стимулирование использования гаранта

### 2. Cryptomus Integration
- Поддержка криптовалют (USDT, BTC, ETH, TON)
- Автоматическая конвертация
- Минимальные комиссии сети

### 3. Эскроу Модель
- Средства замораживаются до подтверждения
- Автоматическое зачисление после подтверждения
- Арбитраж для спорных ситуаций

### 4. Гибкие Комиссии
- Разные ставки для разных типов операций
- Временные акции (validFrom/validTo)
- Мин/макс ограничения

## 📦 Зависимости для Фазы 5

Следующая фаза (Mini App - Интерфейс Чатов) будет использовать:
- **Payment** модель для отображения истории платежей
- **PaymentStatus** для визуализации статусов
- **PaymentService** для создания платежей из Mini App
- **CryptomusService** для генерации платёжных ссылок

## 🚀 Запуск и Настройка

### 1. Регистрация в Cryptomus
1. Перейти на https://cryptomus.com
2. Создать аккаунт мерчанта
3. Получить API ключ и Merchant ID
4. Добавить в .env

### 2. Настройка Webhook
```
Webhook URL: https://your-domain.com/api/webhook/cryptomus
```

### 3. Применение Миграций
```bash
docker-compose exec user-service npm run migration:run
```

## 🧪 Тестирование

### Песочница Cryptomus
```env
CRYPTOMUS_SANDBOX=true
```

### Тестовые Сценарии
1. Создание платежа
2. Оплата через песочницу
3. Проверка callback
4. Возврат средств

---

**Статус**: ✅ Фаза 4 Завершена
**Дата**: 12 марта 2026
**Готовность к Фазе 5**: 100%
