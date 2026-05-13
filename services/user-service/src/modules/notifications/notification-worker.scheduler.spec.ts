import { NotificationWorkerScheduler } from './notification-worker.scheduler';
import { OutboxEvent, OutboxStatus } from '../ops/entities/outbox-event.entity';

describe('NotificationWorkerScheduler', () => {
  const event: OutboxEvent = {
    id: 'evt-1',
    aggregateType: 'deal',
    aggregateId: 'deal-1',
    eventType: 'deal.created',
    payload: {},
    status: OutboxStatus.IN_FLIGHT,
    attempts: 0,
    lastError: null,
    availableAt: new Date(),
    deliveredAt: null,
    createdAt: new Date(),
  };

  it('defers quiet-hours notifications instead of marking them delivered', async () => {
    const outbox = {
      claimBatch: jest.fn().mockResolvedValue([event]),
      defer: jest.fn().mockResolvedValue(undefined),
      markDelivered: jest.fn(),
      markFailed: jest.fn(),
    };
    const dispatcher = {
      dispatch: jest.fn().mockResolvedValue({
        delivered: 0,
        skipped: 1,
        deferredMs: 60_000,
        unhandled: false,
      }),
    };
    const scheduler = new NotificationWorkerScheduler(
      outbox as any,
      dispatcher as any,
      { get: jest.fn((_key: string, fallback: string) => fallback) } as any,
      { deleteCronJob: jest.fn() } as any,
    );
    scheduler.onModuleInit();

    await scheduler.tick();

    expect(outbox.defer).toHaveBeenCalledWith(event.id, 60_000);
    expect(outbox.markDelivered).not.toHaveBeenCalled();
    expect(outbox.markFailed).not.toHaveBeenCalled();
  });
});
