import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SchedulerRegistry } from '@nestjs/schedule';
import { NotificationWorkerScheduler } from './notification-worker.scheduler';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { OutboxService } from '../ops/outbox.service';
import { OutboxEvent, OutboxStatus } from '../ops/entities/outbox-event.entity';

/**
 * Drives the scheduler's tick() against a mocked outbox + dispatcher to
 * verify the routing logic between deliver / defer / fail outcomes.
 */
describe('NotificationWorkerScheduler', () => {
  let scheduler: NotificationWorkerScheduler;
  let outbox: { claimBatch: jest.Mock; markDelivered: jest.Mock; markFailed: jest.Mock; defer: jest.Mock };
  let dispatcher: { dispatch: jest.Mock };

  const makeEvent = (id: string, eventType = 'deal.created'): OutboxEvent => ({
    id,
    aggregateType: 'deal',
    aggregateId: 'd-1',
    eventType,
    payload: {},
    status: OutboxStatus.IN_FLIGHT,
    attempts: 0,
    lastError: null,
    availableAt: new Date(),
    deliveredAt: null,
    createdAt: new Date(),
  });

  beforeEach(async () => {
    outbox = {
      claimBatch: jest.fn(),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
      defer: jest.fn(),
    };
    dispatcher = { dispatch: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationWorkerScheduler,
        { provide: OutboxService, useValue: outbox },
        { provide: NotificationDispatcher, useValue: dispatcher },
        { provide: ConfigService, useValue: { get: () => 'true' } },
        {
          provide: SchedulerRegistry,
          useValue: { deleteCronJob: jest.fn() },
        },
      ],
    }).compile();

    scheduler = module.get(NotificationWorkerScheduler);
    scheduler.onModuleInit();
  });

  it('marks delivered events as delivered', async () => {
    outbox.claimBatch.mockResolvedValue([makeEvent('e-1')]);
    dispatcher.dispatch.mockResolvedValue({
      delivered: 1,
      skipped: 0,
      deferredMs: null,
      unhandled: false,
    });

    await scheduler.tick();

    expect(outbox.markDelivered).toHaveBeenCalledWith('e-1');
    expect(outbox.defer).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('defers (does NOT mark delivered) when dispatcher returns deferredMs > 0', async () => {
    outbox.claimBatch.mockResolvedValue([makeEvent('e-2')]);
    dispatcher.dispatch.mockResolvedValue({
      delivered: 0,
      skipped: 1,
      deferredMs: 30 * 60 * 1000,
      unhandled: false,
    });

    await scheduler.tick();

    expect(outbox.defer).toHaveBeenCalledWith('e-2', 30 * 60 * 1000);
    expect(outbox.markDelivered).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });

  it('marks failed when dispatcher throws (transport error)', async () => {
    outbox.claimBatch.mockResolvedValue([makeEvent('e-3')]);
    dispatcher.dispatch.mockRejectedValue(new Error('telegram down'));

    await scheduler.tick();

    expect(outbox.markFailed).toHaveBeenCalledWith(
      'e-3',
      expect.objectContaining({ message: 'telegram down' }),
    );
    expect(outbox.markDelivered).not.toHaveBeenCalled();
    expect(outbox.defer).not.toHaveBeenCalled();
  });

  it('marks unhandled events as delivered (no template registered)', async () => {
    outbox.claimBatch.mockResolvedValue([makeEvent('e-4', 'unknown.type')]);
    dispatcher.dispatch.mockResolvedValue({
      delivered: 0,
      skipped: 0,
      deferredMs: null,
      unhandled: true,
    });

    await scheduler.tick();

    expect(outbox.markDelivered).toHaveBeenCalledWith('e-4');
    expect(outbox.defer).not.toHaveBeenCalled();
  });

  it('skips entirely when NOTIFICATIONS_ENABLED=false', async () => {
    const module = await Test.createTestingModule({
      providers: [
        NotificationWorkerScheduler,
        { provide: OutboxService, useValue: outbox },
        { provide: NotificationDispatcher, useValue: dispatcher },
        { provide: ConfigService, useValue: { get: () => 'false' } },
        {
          provide: SchedulerRegistry,
          useValue: { deleteCronJob: jest.fn() },
        },
      ],
    }).compile();
    const disabled = module.get(NotificationWorkerScheduler);
    disabled.onModuleInit();

    await disabled.tick();
    expect(outbox.claimBatch).not.toHaveBeenCalled();
  });
});
