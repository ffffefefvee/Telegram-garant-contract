import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Headers,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService, CreateUserDto, UpdateUserDto } from './user.service';
import { User, UserStatus, UserType } from './entities/user.entity';
import { SessionType } from './entities/user-session.entity';
import { LanguageCode } from './entities/language-preference.entity';

@Controller('users')
export class UserController {
  constructor(private userService: UserService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() data: CreateUserDto): Promise<User> {
    return this.userService.create(data);
  }

  @Get('telegram/:telegramId')
  async findByTelegramId(
    @Param('telegramId', ParseIntPipe) telegramId: number,
  ): Promise<User | null> {
    return this.userService.findByTelegramId(telegramId);
  }

  @Get('email/:email')
  async findByEmail(@Param('email') email: string): Promise<User | null> {
    return this.userService.findByEmail(email);
  }

  @Get('me')
  async getCurrentUser(@Headers() headers: any): Promise<User> {
    const user = (headers as any).user;
    return user;
  }

  @Get(':id')
  async findById(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.userService.findById(id);
  }

  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserDto,
  ): Promise<User> {
    return this.userService.update(id, data);
  }

  @Post(':id/sessions')
  async createSession(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      type: SessionType;
      ipAddress?: string;
      userAgent?: string;
      deviceInfo?: string;
      expiresIn?: number;
    },
  ): Promise<{ token: string; expiresAt: Date }> {
    const session = await this.userService.createSession({
      userId: id,
      ...body,
    });

    return {
      token: session.token,
      expiresAt: session.expiresAt,
    };
  }

  @Delete(':id/sessions/:token')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeSession(
    @Param('token') token: string,
  ): Promise<void> {
    await this.userService.revokeSession(token);
  }

  @Post(':id/language')
  async setLanguage(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { languageCode: LanguageCode; context?: string },
  ): Promise<{ languageCode: LanguageCode }> {
    await this.userService.setUserLanguage(
      id,
      body.languageCode,
      body.context || 'global',
    );

    return { languageCode: body.languageCode };
  }

  @Get(':id/language')
  async getLanguage(
    @Param('id', ParseUUIDPipe) id: string,
    @Headers('x-context') context?: string,
  ): Promise<{ languageCode: LanguageCode }> {
    const languageCode = await this.userService.getUserLanguage(
      id,
      context || 'global',
    );

    return { languageCode };
  }

  @Put(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: UserStatus },
  ): Promise<User> {
    return this.userService.setStatus(id, body.status);
  }

  @Post(':id/ban')
  async ban(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason?: string },
  ): Promise<User> {
    return this.userService.ban(id, body.reason);
  }

  @Post(':id/unban')
  async unban(@Param('id', ParseUUIDPipe) id: string): Promise<User> {
    return this.userService.unban(id);
  }

  @Post(':id/roles')
  async addRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { role: UserType },
  ): Promise<User> {
    return this.userService.addRole(id, body.role);
  }

  @Delete(':id/roles/:role')
  async removeRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('role') role: UserType,
  ): Promise<User> {
    return this.userService.removeRole(id, role);
  }

  @Get(':id/stats')
  async getStats(@Param('id', ParseUUIDPipe) id: string): Promise<{
    totalDeals: number;
    successRate: number;
    reputationScore: number;
    balance: number;
  }> {
    return this.userService.getUserStats(id);
  }

  @Post(':id/balance')
  async updateBalance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { amount: number },
  ): Promise<User> {
    return this.userService.updateBalance(id, body.amount);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async softDelete(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.userService.softDelete(id);
  }
}
