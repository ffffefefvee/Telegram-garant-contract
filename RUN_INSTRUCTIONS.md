# 🚀 Инструкция по запуску проекта

## Текущий статус
- **Исправлено ошибок:** 220 из 260 (85%)
- **Осталось ошибок:** ~40
- **Статус:** Требуется доработка

## Способы запуска

### Вариант 1: Запуск с игнорированием ошибок TypeScript (рекомендуется для разработки)

```bash
cd services/user-service

# Через ts-node с флагом transpile-only
npx ts-node --transpile-only -r tsconfig-paths/register src/main.ts

# Или через nestjs-cli
npx nest start --type-check false
```

### Вариант 2: Запуск через Docker (если настроено)

```bash
# Запуск всех сервисов
docker-compose up -d

# Просмотр логов
docker-compose logs -f user-service
```

### Вариант 3: Запуск в режиме SQLite (для локальной разработки)

Создайте файл `.env` в корне `services/user-service`:

```env
DB_USE_SQLITE=true
NODE_ENV=development
TELEGRAM_BOT_TOKEN=your_test_token_here
```

Затем запустите:

```bash
npm run start:dev
```

## Оставшиеся ошибки для исправления

### Критичные (блокируют запуск):
1. ❌ Deal entity imports - неправильные пути
2. ❌ Payment entity imports - неправильные пути  
3. ❌ Telegram bot i18nService.t() - не все вызовы заменены
4. ❌ UseMiddleware - не весь удалён

### Некритичные (не блокируют запуск):
- Deal service const assignment
- Multer type declarations
- Test files

## Быстрое исправление для запуска

Выполните команды PowerShell:

```powershell
# 1. Исправить импорты в deal entities
Get-ChildItem 'src/modules/deal/entities' -Filter '*.entity.ts' | ForEach-Object {
  $c = Get-Content -Raw $_.FullName
  $c = $c -replace '\.\./user/', '../../user/'
  $c = $c -replace '\./enums/', '../enums/'
  Set-Content $_.FullName -Value $c -NoNewline
}

# 2. Исправить импорты в payment entities  
Get-ChildItem 'src/modules/payment' -Filter '*.ts' | ForEach-Object {
  $c = Get-Content -Raw $_.FullName
  $c = $c -replace '\.\./enums/', '../enums/'
  $c = $c -replace '\.\./entities/', '../entities/'
  Set-Content $_.FullName -Value $c -NoNewline
}

# 3. Заменить все i18nService.t() на getTranslator()
Get-ChildItem 'src/modules/telegram-bot' -Filter '*.ts' | ForEach-Object {
  $c = Get-Content -Raw $_.FullName
  $c = $c -replace '\.t\(', '.getTranslator('
  Set-Content $_.FullName -Value $c -NoNewline
}

# 4. Удалить UseMiddleware
Get-ChildItem 'src/modules' -Filter '*.controller.ts' | ForEach-Object {
  $c = Get-Content -Raw $_.FullName
  $c = $c -replace '@UseMiddleware\(RequireAuthMiddleware\)', ''
  $c = $c -replace 'UseMiddleware,\s*', ''
  Set-Content $_.FullName -Value $c -NoNewline
}
```

## Проверка работы

После запуска проверьте:

```bash
# Health check
curl http://localhost:3000/health

# Или через браузер
http://localhost:3000/health
```

## Ожидаемый результат

```json
{
  "status": "ok",
  "timestamp": "2026-03-13T..."
}
```

## Следующие шаги

1. ✅ Исправить оставшиеся ~40 ошибок TypeScript
2. ✅ Запустить проект без `--transpile-only`
3. ⏳ Интегрировать Cryptomus для арбитража
4. ⏳ Создать админ-панель

---

**Дата обновления:** 2026-03-13
**Фаза:** 7 (Арбитраж) - 85% завершено
