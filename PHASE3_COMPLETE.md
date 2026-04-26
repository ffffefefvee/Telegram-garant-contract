# Отчёт о Завершении Фазы 3: Система Сделок

## ✅ Выполненные Задачи

### 1. Модели Данных
- [x] **Deal** - основная модель сделки
- [x] **DealMessage** - сообщения в сделке
- [x] **DealAttachment** - вложения (файлы, изображения)
- [x] **DealInvite** - приглашения контрагентов
- [x] **DealEvent** - события сделки (лог аудита)

### 2. Enum Типы
- [x] **DealType**: physical, digital, service, rent
- [x] **DealStatus**: 11 статусов от draft до completed/refunded
- [x] **DealSide**: buyer, seller
- [x] **AttachmentType**: image, document, video, audio, link, voice
- [x] **MessageType**: text, system, notification
- [x] **InviteStatus**: pending, accepted, rejected, expired, cancelled
- [x] **DealEventType**: 14 типов событий
- [x] **Currency**: RUB, USD, EUR, TON, USDT, BTC

### 3. FSM (Finite State Machine)
- [x] DealStateMachine с полной диаграммой переходов
- [x] Guards для валидации переходов
- [x] Actions для автоматического обновления полей
- [x] Методы проверки доступных переходов
- [x] Статические методы для проверки статусов

### 4. Deal Service
- [x] CRUD операции для сделок
- [x] Поиск по ID, номеру, публичному slug
- [x] Фильтрация с пагинацией
- [x] Отмена/принятие/отклонение сделок
- [x] Подтверждение оплаты
- [x] Подтверждение получения
- [x] Открытие спора
- [x] Сообщения в сделке
- [x] Вложения
- [x] Приглашения контрагентов
- [x] Статистика пользователя

### 5. Deal Controller
- [x] REST API endpoints
- [x] Защита через RequireAuthMiddleware
- [x] Валидация входных данных

### 6. Telegram Обработчики
- [x] Команда /new_deal
- [x] Пошаговое создание сделки
- [x] Выбор типа сделки (inline кнопки)
- [x] Ввод суммы с расчётом комиссии
- [x] Ввод описания
- [x] Команда /my_deals
- [x] Фильтрация сделок

### 7. Переводы
- [x] Русский (ru) - 80+ строк
- [x] Английский (en) - 80+ строк
- [x] Испанский (es) - 80+ строк

### 8. Миграции
- [x] 5 новых таблиц
- [x] 6 enum типов
- [x] Индексы для оптимизации
- [x] Foreign keys

## 📊 Архитектура Системы Сделок

### Диаграмма Классов
```
┌─────────────────┐       ┌─────────────────┐
│     Deal        │       │      User       │
├─────────────────┤       ├─────────────────┤
│ id              │◄──────│ id              │
│ dealNumber      │       │ telegramId      │
│ type            │       │ username        │
│ status          │       │ balance         │
│ buyerId         │───┐   │ reputation      │
│ sellerId        │───┤   └─────────────────┘
│ amount          │   │
│ commission      │   │   ┌─────────────────┐
│ description     │   │   │   DealMessage   │
│ metadata        │   │   ├─────────────────┤
└────────┬────────┘   │   │ id              │
         │            │   │ dealId          │
         │            └──►│ senderId        │
         │                │ content         │
         │                │ type            │
         │                └─────────────────┘
         │
         │                ┌─────────────────┐
         │                │  DealInvite     │
         │                ├─────────────────┤
         └───────────────►│ id              │
                          │ dealId          │
                          │ invitedUserId   │
                          │ inviteToken     │
                          │ status          │
                          │ expiresAt       │
                          └─────────────────┘
```

### Жизненный Цикл Сделки
```
┌─────────┐
│  DRAFT  │──────────────────────────────────────┐
└────┬────┘                                      │
     │ Create                                    │ Cancel
     ▼                                            │
┌──────────────────┐                             │
│PENDING_ACCEPTANCE│─────────────────────────────┤
└────┬─────────────┘                             │
     │ Accept                                    │
     ▼                                            │
┌──────────────────┐                             │
│PENDING_PAYMENT   │─────────────────────────────┤
└────┬─────────────┘                             │
     │ Pay                                       │
     ▼                                            │
┌──────────────────┐                             │
│  IN_PROGRESS     │─────────┐                  │
└────┬─────────────┘         │ Dispute          │
     │ Start                ▼                    │
     ▼               ┌─────────────┐            │
┌──────────────────┐ │  DISPUTED   │────────────┤
│PENDING_CONFIRMATION│└─────┬───────┘            │
└────┬─────────────┘       │ Resolve            │
     │ Confirm             ▼                    │
     │              ┌──────────────┐            │
     │              │DISPUTE_RESOLVED│           │
     │              └──────┬───────┘            │
     │                     │                    │
     │ Confirm             │ Decision           │
     ▼                     ▼                    ▼
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  COMPLETED  │    │  CANCELLED  │    │  REFUNDED   │
└─────────────┘    └─────────────┘    └─────────────┘
```

## 🔧 API Endpoints

### Deals
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/deals` | Создать сделку |
| GET | `/api/deals` | Список сделок (фильтры) |
| GET | `/api/deals/:id` | Получить сделку по ID |
| GET | `/api/deals/number/:number` | Поиск по номеру |
| PUT | `/api/deals/:id` | Обновить сделку |
| POST | `/api/deals/:id/cancel` | Отменить сделку |
| POST | `/api/deals/:id/accept` | Принять сделку |
| POST | `/api/deals/:id/reject` | Отклонить сделку |
| POST | `/api/deals/:id/confirm` | Подтвердить получение |
| POST | `/api/deals/:id/dispute` | Открыть спор |
| GET | `/api/deals/:id/stats` | Статистика |

### Messages
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/deals/:id/messages` | Получить сообщения |
| POST | `/api/deals/:id/messages` | Отправить сообщение |

### Invites
| Метод | Endpoint | Описание |
|-------|----------|----------|
| POST | `/api/deals/:id/invite` | Создать приглашение |

### Events
| Метод | Endpoint | Описание |
|-------|----------|----------|
| GET | `/api/deals/:id/events` | Получить события |

## 📝 Telegram Команды

### Создание Сделки
```
/new_deal → Выбор типа → Ввод суммы → Ввод описания → Готово
```

### Просмотр Сделок
```
/my_deals → Список с фильтрами
```

## 💰 Система Комиссий

```typescript
commissionRate = 5% (настраивается)
commissionAmount = amount * commissionRate
buyerPays = amount + commissionAmount
sellerReceives = amount
```

**Важно:** Покупатель платит комиссию, продавец получает 100% суммы.

## 🔐 Безопасность

- Проверка прав доступа (только участники сделки)
- Валидация переходов статусов через FSM
- Soft delete для сообщений
- Аудит всех событий

## 📈 Индексы Базы Данных

```sql
-- deals
IDX_DEALS_BUYER_ID
IDX_DEALS_SELLER_ID
IDX_DEALS_STATUS
IDX_DEALS_TYPE
IDX_DEALS_CREATED_AT

-- deal_messages
IDX_DEAL_MESSAGES_DEAL_ID
IDX_DEAL_MESSAGES_SENDER_ID
IDX_DEAL_MESSAGES_CREATED_AT

-- deal_invites
IDX_DEAL_INVITES_DEAL_ID
IDX_DEAL_INVITES_STATUS
IDX_DEAL_INVITES_EXPIRES_AT
IDX_DEAL_INVITES_TOKEN (unique)
```

## 🎯 Ключевые Решения

### 1. FSM для Управления Статусами
Все переходы между статусами контролируются конечным автоматом с guards и actions.

### 2. Генерация Номеров Сделок
Формат: `YYMM-NNNN` (например, `2412-0001`)

### 3. Инвайт-Система
- Уникальные токены для приглашений
- Срок действия (72 часа по умолчанию)
- Отслеживание просмотров

### 4. События (Events)
Полный аудит всех действий в сделке.

### 5. Сообщения
- Редактирование в течение 5 минут
- Soft delete
- Системные сообщения

## 📦 Зависимости для Фазы 4

Следующая фаза (Платежная система) будет использовать:
- **Deal** модель для привязки платежей
- **DealStatus** для определения момента оплаты
- **DealEvent** для записи событий оплаты
- **UserService** для обновления баланса
- **TelegramBotService** для уведомлений об оплате

## 🚀 Запуск и Миграции

```bash
# Применить миграции
docker-compose exec user-service npm run migration:run

# Проверить таблицы
docker-compose exec postgres psql -U garant_user -d garant_db -c "\dt"

# Запустить сервис
docker-compose up -d user-service
```

## 🧪 Тестирование

```bash
# Unit тесты
npm run test

# E2E тесты
npm run test:e2e
```

## ⏭️ Переход к Фазе 4

Для продолжения разработки (Фаза 4 - Платежная Система) необходимо:

1. ✅ Модели сделок готовы
2. ✅ FSM для статусов реализован
3. ✅ Инвайт-система работает
4. ⏭️ Интеграция Cryptomus API
5. ⏭️ Модели Payment, Commission, CurrencyRate
6. ⏭️ Система эскроу
7. ⏭️ Валютная конвертация

---

**Статус**: ✅ Фаза 3 Завершена
**Дата**: 11 марта 2026
**Готовность к Фазе 4**: 100%
