import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { UserSession } from './entities/user-session.entity';
import { LanguagePreference } from './entities/language-preference.entity';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { RequireAuthMiddleware } from '../auth/auth.middleware';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, UserSession, LanguagePreference]),
  ],
  controllers: [UserController],
  providers: [
    UserService,
    RequireAuthMiddleware,
  ],
  exports: [UserService, TypeOrmModule],
})
export class UserModule {}
