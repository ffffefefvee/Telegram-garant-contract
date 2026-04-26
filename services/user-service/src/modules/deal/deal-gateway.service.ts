import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DealMessage, MessageType } from './entities/deal-message.entity';
import { UserService } from '../user/user.service';

@Injectable()
export class DealGatewayService {
  private readonly logger = new Logger(DealGatewayService.name);

  constructor(
    @InjectRepository(DealMessage)
    private messageRepository: Repository<DealMessage>,
    private userService: UserService,
  ) {}

  async saveMessage(
    dealId: string,
    userId: string,
    content: string,
    type: string = 'text',
  ): Promise<DealMessage> {
    const message = this.messageRepository.create({
      dealId,
      senderId: userId,
      content,
      type: type as MessageType,
    });

    const saved = await this.messageRepository.save(message);

    this.logger.log(`Message saved: ${saved.id} for deal ${dealId}`);

    return saved;
  }

  async validateAccess(dealId: string, token: string): Promise<boolean> {
    try {
      const user = await this.userService.findSessionByToken(token);
      if (!user) return false;

      const isParticipant = true;
      return isParticipant;
    } catch {
      return false;
    }
  }

  async getMessages(dealId: string, limit: number = 50, offset: number = 0) {
    return this.messageRepository.find({
      where: { dealId, isDeleted: false },
      relations: ['sender'],
      order: { createdAt: 'ASC' },
      skip: offset,
      take: limit,
    });
  }
}