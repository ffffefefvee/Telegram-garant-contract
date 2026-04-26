import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Entities
import { Dispute } from './entities/dispute.entity';
import { Evidence } from './entities/evidence.entity';
import { ArbitrationChat } from './entities/arbitration-chat.entity';
import { ArbitrationChatMessage } from './entities/arbitration-chat-message.entity';
import { ArbitrationDecision } from './entities/arbitration-decision.entity';
import { ArbitrationEvent } from './entities/arbitration-event.entity';
import { Appeal } from './entities/appeal.entity';
import { DealTerms } from './entities/deal-terms.entity';
import { ArbitrationSettings } from './entities/arbitration-settings.entity';
import { ArbitratorProfile } from './entities/arbitrator-profile.entity';

// Services
import { ArbitrationService } from './arbitration.service';
import { DisputeService } from './dispute.service';
import { EvidenceService } from './evidence.service';
import { ArbitratorService } from './arbitrator.service';
import { ArbitrationSettingsService } from './arbitration-settings.service';

// Controllers
import { ArbitrationController } from './arbitration.controller';
import { AdminArbitrationController } from './admin-arbitration.controller';

// External modules
import { UserModule } from '../user/user.module';
import { DealModule } from '../deal/deal.module';
import { PaymentModule } from '../payment/payment.module';
import { ReviewModule } from '../review/review.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Dispute,
      Evidence,
      ArbitrationChat,
      ArbitrationChatMessage,
      ArbitrationDecision,
      ArbitrationEvent,
      Appeal,
      DealTerms,
      ArbitrationSettings,
      ArbitratorProfile,
    ]),
    forwardRef(() => UserModule),
    forwardRef(() => DealModule),
    forwardRef(() => PaymentModule),
    ReviewModule,
  ],
  controllers: [ArbitrationController, AdminArbitrationController],
  providers: [
    ArbitrationService,
    DisputeService,
    EvidenceService,
    ArbitratorService,
    ArbitrationSettingsService,
  ],
  exports: [
    ArbitrationService,
    DisputeService,
    EvidenceService,
    ArbitratorService,
    ArbitrationSettingsService,
    TypeOrmModule,
  ],
})
export class ArbitrationModule {}
