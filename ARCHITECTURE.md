# Архитектурная Документация - Фаза 2

## 1. Общее Описание

### 1.1 Назначение
Система пользователей и многоязычности для Telegram Guarantee Bot - enterprise-level платформы гарантийных сделок.

### 1.2 Технологический Стек
- **Backend**: Nest.js 10.x (TypeScript)
- **База данных**: PostgreSQL 15
- **Кэш/Сессии**: Redis 7
- **Telegram Bot**: Telegraf 4.x
- **i18n**: i18next с горячей перезагрузкой
- **Контейнеризация**: Docker & Docker Compose

## 2. Архитектурные Решения

### 2.1 Микросервисная Архитектура
```
┌─────────────────────────────────────────────────────────┐
│                    Docker Network                        │
│                                                          │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────┐ │
│  │   PostgreSQL │    │    Redis     │    │User Service│ │
│  │   :5432      │    │    :6379     │    │   :3001    │ │
│  └──────┬───────┘    └──────┬───────┘    └─────┬──────┘ │
│         │                   │                   │        │
│         └───────────────────┼───────────────────┘        │
│                             │                             │
│                  ┌──────────▼──────────┐                 │
│                  │  Telegram Bot API   │                 │
│                  └─────────────────────┘                 │
└─────────────────────────────────────────────────────────┘
```

### 2.2 Слои Приложения
```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Telegram Bot + REST API Controllers)  │
├─────────────────────────────────────────┤
│         Middleware Layer                │
│  (Auth, Logging, Validation, i18n)      │
├─────────────────────────────────────────┤
│         Business Logic Layer            │
│  (Services: User, Session, Language)    │
├─────────────────────────────────────────┤
│         Data Access Layer               │
│  (TypeORM Repositories + Redis)         │
└─────────────────────────────────────────┘
```

## 3. Модели Данных

### 3.1 Диаграмма ERD
```
┌─────────────────┐       ┌─────────────────┐
│     users       │       │language_prefs   │
├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ user_id (FK)    │
│ telegram_id     │       │ language_code   │
│ email           │       │ context         │
│ status          │       │ usage_count     │
│ roles[]         │       └─────────────────┘
│ balance         │
│ reputation      │       ┌─────────────────┐
└────────┬────────┘       │  user_sessions  │
         │                ├─────────────────┤
         └────────────────│ user_id (FK)    │
                          │ token           │
                          │ type            │
                          │ expires_at      │
                          └─────────────────┘
```

### 3.2 Индексы
```sql
-- users
CREATE INDEX IDX_USERS_TELEGRAM_ID ON users(telegram_id);
CREATE INDEX IDX_USERS_EMAIL ON users(email);
CREATE INDEX IDX_USERS_STATUS ON users(status);

-- user_sessions
CREATE INDEX IDX_USER_SESSIONS_USER_ID ON user_sessions(user_id);
CREATE INDEX IDX_USER_SESSIONS_TOKEN ON user_sessions(token);
CREATE INDEX IDX_USER_SESSIONS_EXPIRES_AT ON user_sessions(expires_at);

-- language_preferences
CREATE UNIQUE INDEX IDX_USER_CONTEXT ON language_preferences(user_id, context);
```

## 4. Бизнес-Логика

### 4.1 Жизненный Цикл Пользователя
```
┌─────────┐    ┌──────────────┐    ┌─────────┐    ┌────────┐
│  Start  │───►│ Registration │───►│ Active  │───►│ Banned │
└─────────┘    └──────────────┘    └────┬────┘    └────────┘
                                        │
                                   ┌────▼────┐
                                   │Inactive │
                                   └─────────┘
```

### 4.2 Управление Сессиями
```
┌──────────┐     ┌───────────┐     ┌──────────┐     ┌─────────┐
│  Create  │────►│  Active   │────►│ Expired  │     │ Revoked │
└──────────┘     └─────┬─────┘     └──────────┘     └─────────┘
                       │
                 ┌─────▼─────┐
                 │ Refreshed │
                 └───────────┘
```

### 4.3 Определение Языка
```
┌─────────────────────┐
│  Новый пользователь │
└──────────┬──────────┘
           │
    ┌──────▼───────┐
    │Telegram Lang?│
    └──────┬───────┘
      Yes  │  No
    ┌──────▼───────┐     ┌──────────────┐
    │Сохранить язык│     │Default (RU)  │
    └──────┬───────┘     └──────────────┘
           │
    ┌──────▼───────┐
    │User Override?│
    └──────┬───────┘
      Yes  │  No
    ┌──────▼───────┐     ┌──────────────┐
    │Update Pref.  │────►│  Return Lang │
    └──────────────┘     └──────────────┘
```

## 5. API Дизайн

### 5.1 REST Convention
```
GET    /api/users          # List users
GET    /api/users/:id      # Get user by ID
POST   /api/users          # Create user
PUT    /api/users/:id      # Update user
DELETE /api/users/:id      # Delete user

GET    /api/users/telegram/:telegramId
POST   /api/users/:id/sessions
DELETE /api/users/:id/sessions/:token
```

### 5.2 Response Format
```typescript
// Success
{
  "data": { ... },
  "meta": {
    "timestamp": "2024-01-01T00:00:00Z",
    "path": "/api/users/123"
  }
}

// Error
{
  "statusCode": 400,
  "message": "Validation failed",
  "errors": [ ... ],
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/api/users"
}
```

## 6. Безопасность

### 6.1 Аутентификация
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Client    │────►│  Middleware  │────►│  Service    │
└─────────────┘     └──────────────┘     └─────────────┘
       │                   │                    │
       │  Bearer Token     │                    │
       │──────────────────►│                    │
       │                   │  Validate Token    │
       │                   │───────────────────►│
       │                   │                    │
       │                   │  User Context      │
       │                   │◄───────────────────│
       │                   │                    │
       │  Authenticated    │                    │
       │◄──────────────────│                    │
```

### 6.2 Защита Данных
- UUID для всех ID
- Soft delete для пользователей
- Шифрование чувствительных данных (будет в Фазе 3)
- Rate limiting (будет в Фазе 3)

## 7. Производительность

### 7.1 Кэширование
```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Request    │────►│    Redis     │────►│  PostgreSQL  │
└──────────────┘     └──────────────┘     └──────────────┘
       │                   │                    │
       │                   │ Hit                │
       │◄──────────────────│                    │
       │                   │                    │
       │                   │ Miss               │
       │                   │───────────────────►│
       │                   │                    │
       │                   │  Data              │
       │                   │◄───────────────────│
       │                   │                    │
       │  Response + Cache │                    │
       │◄──────────────────│                    │
```

### 7.2 Оптимизация Запросов
- Eager loading для связанных данных
- Индексы на часто используемых полях
- Пагинация для списков

## 8. Масштабируемость

### 8.1 Горизонтальное Масштабирование
```
┌─────────────────────────────────────────┐
│          Load Balancer                  │
└───────────────┬─────────────────────────┘
                │
    ┌───────────┼───────────┐
    │           │           │
┌───▼───┐  ┌───▼───┐  ┌───▼───┐
│User-1 │  │User-2 │  │User-3 │
└───┬───┘  └───┬───┘  └───┬───┘
    │          │          │
    └──────────┼──────────┘
               │
    ┌──────────▼──────────┐
    │   Shared PostgreSQL │
    │   Shared Redis      │
    └─────────────────────┘
```

### 8.2 Конфигурация для Продакшена
```yaml
# docker-compose.prod.yml
services:
  user-service:
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
```

## 9. Мониторинг и Логирование

### 9.1 Уровни Логирования
```
DEBUG   - Детальная отладочная информация
INFO    - Важные события (старт, остановка)
WARN    - Предупреждения (некритичные ошибки)
ERROR   - Критические ошибки
FATAL   - Фатальные ошибки (падение сервиса)
```

### 9.2 Метрики для Мониторинга
- RPS (Requests Per Second)
- Response Time (p50, p95, p99)
- Error Rate
- Active Sessions
- Database Connections
- Cache Hit Rate

## 10. План Развития

### Текущая Фаза (2) ✅
- [x] Модели пользователей
- [x] Система сессий
- [x] Многоязычность
- [x] Telegram Bot интеграция

### Следующая Фаза (3) ⏭️
- [ ] Модели Deal, DealMessage, DealAttachment
- [ ] FSM для 4 типов сделок
- [ ] Инвайт-система
- [ ] Система статусов сделок

### Будущие Фазы
- [ ] Фаза 4: Платежная система
- [ ] Фаза 5: Mini App
- [ ] Фаза 6: Отзывы и репутация
- [ ] Фаза 7: Арбитраж
- [ ] Фаза 8: Админ-панель
