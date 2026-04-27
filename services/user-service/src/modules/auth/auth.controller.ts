import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { AuthService, AuthSession } from './auth.service';

export class TelegramLoginDto {
  /** Raw `window.Telegram.WebApp.initData` string (URL-encoded form-data). */
  initData: string;
}

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  /**
   * POST /api/auth/telegram
   *
   * Body: { initData: string }
   *
   * Validates the Telegram WebApp `initData` payload, upserts the User by
   * Telegram ID, and returns a signed JWT to use as the Bearer token for
   * subsequent requests.
   */
  @Post('telegram')
  @HttpCode(200)
  async telegramLogin(@Body() body: TelegramLoginDto): Promise<AuthSession> {
    return this.auth.loginWithInitData(body?.initData ?? '');
  }
}
