import { Module, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { RequireAuthMiddleware } from './auth.middleware';

@Module({
  providers: [RequireAuthMiddleware],
  exports: [RequireAuthMiddleware],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Применяем middleware ко всем routes кроме health checks
    consumer
      .apply(RequireAuthMiddleware)
      .exclude(
        { path: 'health', method: RequestMethod.GET },
        { path: 'ping', method: RequestMethod.GET },
      )
      .forRoutes('*');
  }
}
