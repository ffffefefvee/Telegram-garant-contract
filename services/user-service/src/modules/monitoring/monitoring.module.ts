import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringService } from './monitoring.service';
import {
  SystemAlert,
  HealthCheck,
  SystemMetrics,
  RecoveryLog,
  JobSchedule,
} from './entities/monitoring.entity';
import { DealModule } from '../deal/deal.module';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SystemAlert, HealthCheck, SystemMetrics, RecoveryLog, JobSchedule]),
    forwardRef(() => DealModule),
    forwardRef(() => PaymentModule),
  ],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}