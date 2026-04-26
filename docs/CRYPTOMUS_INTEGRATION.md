# 🔐 Cryptomus Integration Guide

## 📋 Что реализовано

✅ **Cryptomus Service** - создание платежей, проверка статуса, payouts  
✅ **Webhook Handler** - обработка callback от Cryptomus  
✅ **Payment Entity** - хранение данных о платежах  
✅ **Multi-Currency** - поддержка RUB, USD, EUR, KZT, USDT  
✅ **Sandbox Mode** - тестовый режим для разработки  

---

## ⚙️ Настройка

### 1. Получите API ключи Cryptomus

1. Зарегистрируйтесь на https://cryptomus.com
2. Перейдите в **Merchant Panel**
3. Создайте новый магазин
4. Скопируйте:
   - **API Key**
   - **Merchant ID**

### 2. Добавьте в .env

```env
# Cryptomus
CRYPTOMUS_API_KEY=ваш_api_key
CRYPTOMUS_MERCHANT_ID=ваш_merchant_id
CRYPTOMUS_SANDBOX=true  # true для тестирования, false для продакшена
```

### 3. Настройте Webhook URL

В Merchant Panel Cryptomus укажите:

```
Callback URL: https://your-domain.com/api/webhook/cryptomus
```

Для локальной разработки используйте **ngrok**:

```bash
ngrok http 3001
```

И укажите в Cryptomus: `https://xxxx.ngrok.io/api/webhook/cryptomus`

---

## 🚀 Использование

### Создание платежа

```typescript
POST /api/payments

{
  "dealId": "uuid-сделки",
  "amount": 50000,
  "currency": "RUB",
  "description": "iPhone 15 Pro"
}

Ответ:
{
  "payment": { ... },
  "paymentUrl": "https://payment.cryptomus.com/xxxxx",
  "expiresAt": "2026-03-13T18:05:01.000Z"
}
```

### Проверка статуса

```typescript
POST /api/payments/:id/check

Ответ:
{
  "id": "...",
  "status": "completed",
  "paidAt": "2026-03-13T17:10:00.000Z",
  "txId": "0x...."
}
```

### Возврат средств

```typescript
POST /api/payments/:id/refund

{
  "reason": "Товар не соответствует описанию"
}
```

---

## 🔄 Webhook Payload

Cryptomus отправляет POST запрос на `/api/webhook/cryptomus`:

```json
{
  "type": "payment",
  "uuid": "unique-payment-id",
  "order_id": "DEAL_123_1710350000000",
  "amount": "50000",
  "currency": "RUB",
  "currency_amount": "500.00",
  "status": "paid",
  "txid": "0x....",
  "network": "polygon",
  "payer_amount": "50000",
  "payer_currency": "RUB"
}
```

**Статусы:**
- `paid` - оплата успешна
- `processing` - в обработке
- `refunded` - возврат
- `cancelled` - отменён
- `expired` - истёк

---

## 🧪 Тестирование

### 1. Включите Sandbox

```env
CRYPTOMUS_SANDBOX=true
```

### 2. Создайте тестовый платёж

```bash
curl -X POST http://localhost:3001/api/payments \
  -H "Content-Type: application/json" \
  -d '{
    "dealId": "test-deal-id",
    "amount": 1000,
    "currency": "RUB"
  }'
```

### 3. Откройте Payment URL

Перейдите по ссылке из ответа и завершите тестовую оплату.

### 4. Проверьте Webhook

В логах сервера вы увидите:

```
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx     LOG [PaymentWebhookService] Webhook received: DEAL_xxx, status: paid
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx     LOG [PaymentWebhookService] Payment completed: DEAL_xxx, TX: 0x...
```

---

## 💰 Поддерживаемые валюты

### Fiat
- 🇷🇺 RUB - Российский рубль
- 🇰🇿 KZT - Тенге
- 🇺🇦 UAH - Гривна
- 🇺🇸 USD - Доллар
- 🇪🇺 EUR - Евро

### Crypto
- USDT (Polygon, TRC-20, ERC-20, BSC)
- USDC (Polygon, ERC-20)
- TON
- BTC
- ETH
- BNB

---

## 🔐 Безопасность

### Верификация подписи

Все Webhook запросы от Cryptomus подписаны. Сервер автоматически проверяет подпись:

```typescript
const expectedSignature = md5(base64(payload) + apiKey);
if (expectedSignature !== signature) {
  // Отклонить запрос
}
```

### Rate Limiting

Рекомендуется добавить rate limiting на Webhook endpoint:

```typescript
@Throttle(100, 60) // 100 запросов в минуту
```

---

## 📊 Мониторинг

### Логи

Все операции логируются:

```
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx     LOG [CryptomusService] Creating payment: {...}
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx     LOG [CryptomusService] Payment created: {...}
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx     LOG [PaymentWebhookService] Webhook received: ...
```

### Ошибки

При ошибках логируются детали:

```
[Nest] xxxxx  - xx/xx/xxxx, xx:xx:xx   ERROR [CryptomusService] Payment creation failed: ...
```

---

## 🚀 Следующие шаги

- [ ] Интеграция со смарт-контрактами (Escrow)
- [ ] Payout API для вывода средств
- [ ] Multi-currency конвертация
- [ ] Админ-панель для управления платежами

---

**Документация Cryptomus:** https://docs.cryptomus.com  
**Support:** support@cryptomus.com
