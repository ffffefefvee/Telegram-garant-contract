import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { StoreService } from './store.service';
import {
  CreateStoreDto,
  UpdateStoreDto,
  CreateBotDto,
  BotSetupDto,
  UpdateBotDto,
  StoreSettingsDto,
  CreateTemplateDto,
  UpdateTemplateDto,
  DuplicateStoreDto,
} from './dto/store.dto';
import { StoreStatus, StoreCategory } from './entities/store.entity';

@Controller('stores')
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createStore(@Request() req: any, @Body() dto: CreateStoreDto) {
    return this.storeService.createStore(req.user.id, dto);
  }

  @Get()
  async findAll(
    @Query('status') status?: StoreStatus,
    @Query('category') category?: StoreCategory,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.storeService.findAllStores(
      { status, category, search, isPublic: true },
      {
        page: page ? parseInt(page) : 1,
        limit: limit ? parseInt(limit) : 20,
      },
    );
  }

  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyStores(@Request() req: any) {
    return this.storeService.getUserStores(req.user.id);
  }

  @Get('search')
  async search(@Query('q') query: string, @Query('limit') limit?: string) {
    return this.storeService.searchStores(query, limit ? parseInt(limit) : 10);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    return this.storeService.findStoreById(id);
  }

  @Get('slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.storeService.findStoreBySlug(slug);
  }

  @Put(':id')
  @UseGuards(AuthGuard('jwt'))
  async updateStore(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: UpdateStoreDto,
  ) {
    return this.storeService.updateStore(id, req.user.id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  async deleteStore(@Param('id') id: string, @Request() req: any) {
    await this.storeService.deleteStore(id, req.user.id);
    return { success: true };
  }

  @Post(':id/activate')
  @UseGuards(AuthGuard('jwt'))
  async activateStore(@Param('id') id: string, @Request() req: any) {
    return this.storeService.activateStore(id, req.user.id);
  }

  @Post(':id/suspend')
  @UseGuards(AuthGuard('jwt'))
  async suspendStore(@Param('id') id: string, @Request() req: any) {
    return this.storeService.suspendStore(id, req.user.id);
  }

  @Post(':id/duplicate')
  @UseGuards(AuthGuard('jwt'))
  async duplicateStore(@Param('id') id: string, @Request() req: any, @Body() dto: DuplicateStoreDto) {
    return this.storeService.duplicateStore(req.user.id, { ...dto, sourceStoreId: id });
  }

  @Get(':id/settings')
  async getSettings(@Param('id') id: string) {
    return this.storeService.getStoreSettings(id);
  }

  @Put(':id/settings')
  @UseGuards(AuthGuard('jwt'))
  async updateSettings(
    @Param('id') id: string,
    @Request() req: any,
    @Body() dto: StoreSettingsDto,
  ) {
    return this.storeService.updateStoreSettings(id, req.user.id, dto);
  }

  @Get(':id/analytics')
  @UseGuards(AuthGuard('jwt'))
  async getAnalytics(@Param('id') id: string, @Request() req: any) {
    return this.storeService.getStoreAnalytics(id, req.user.id);
  }

  @Post(':id/bot')
  @UseGuards(AuthGuard('jwt'))
  async createBot(@Param('id') id: string, @Body() dto: Omit<CreateBotDto, 'storeId'>) {
    return this.storeService.createBot({ storeId: id, ...dto });
  }

  @Get(':id/bot')
  async getBot(@Param('id') id: string) {
    return this.storeService.getBotByStoreId(id);
  }

  @Post(':id/bot/setup')
  @UseGuards(AuthGuard('jwt'))
  async setupBot(@Param('id') id: string, @Request() req: any, @Body() dto: BotSetupDto) {
    return this.storeService.setupBot(id, req.user.id, dto);
  }

  @Put(':id/bot')
  @UseGuards(AuthGuard('jwt'))
  async updateBot(@Param('id') id: string, @Request() req: any, @Body() dto: UpdateBotDto) {
    return this.storeService.updateBot(id, req.user.id, dto);
  }

  @Delete(':id/bot')
  @UseGuards(AuthGuard('jwt'))
  async deleteBot(@Param('id') id: string, @Request() req: any) {
    await this.storeService.deleteBot(id, req.user.id);
    return { success: true };
  }

  @Get('templates')
  async getTemplates() {
    return this.storeService.getTemplates();
  }

  @Post('templates')
  @UseGuards(AuthGuard('jwt'))
  async createTemplate(@Body() dto: CreateTemplateDto) {
    return this.storeService.createTemplate(dto);
  }

  @Get('templates/:id')
  async getTemplate(@Param('id') id: string) {
    return this.storeService.getTemplateById(id);
  }

  @Post(':id/apply-template/:templateId')
  @UseGuards(AuthGuard('jwt'))
  async applyTemplate(
    @Param('id') id: string,
    @Param('templateId') templateId: string,
    @Request() req: any,
  ) {
    return this.storeService.applyTemplate(id, req.user.id, templateId);
  }
}