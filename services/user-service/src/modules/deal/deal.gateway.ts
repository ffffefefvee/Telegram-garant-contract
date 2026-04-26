import { Logger } from '@nestjs/common';

export class DealGateway {
  private readonly logger = new Logger(DealGateway.name);

  afterInit() {
    this.logger.log('Deal Gateway initialized (stub mode)');
  }

  handleConnection(client: any) {
    this.logger.log(`Client ${client?.id} connecting`);
  }

  handleDisconnect(client: any) {
    this.logger.log(`Client ${client?.id} disconnected`);
  }
}

export class DealGatewayService {
  private readonly logger = new Logger(DealGatewayService.name);

  async saveMessage(dealId: string, userId: string, content: string, type: string) {
    this.logger.log(`Message saved for deal ${dealId}: ${content}`);
    return { id: 'stub', dealId, senderId: userId, content, type, createdAt: new Date() };
  }

  async validateAccess(dealId: string, token: string): Promise<boolean> {
    return true;
  }

  async getMessages(dealId: string, limit: number = 50, offset: number = 0) {
    return [];
  }
}