import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

export interface UserPayload {
  id: string;
  telegramId?: number | null;
  telegramUsername?: string | null;
  telegramLanguageCode?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: UserPayload;
    }
  }
}

/**
 * Простой middleware для аутентификации
 * Временно заглушка - требует полноценной JWT реализации
 */
@Injectable()
export class RequireAuthMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    // ВРЕМЕННО: Создаём фиктивного пользователя для тестирования
    // TODO: Реализовать полноценную JWT аутентификацию
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Здесь будет JWT верификация
      // Пока создаём заглушку
      req.user = {
        id: 'temp-user-id',
        telegramId: 123456789,
        telegramUsername: 'test_user',
        telegramLanguageCode: 'ru',
      };
    } else {
      // Для Telegram бота создаём временного пользователя
      req.user = {
        id: 'temp-user-id',
        telegramId: 123456789,
        telegramUsername: 'telegram_user',
        telegramLanguageCode: 'ru',
      };
    }

    next();
  }
}
