import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuditLogService } from './audit-log.service';
import { AuditLogEntry } from './entities/audit-log.entity';

function makeRepo(): any {
  const rows: AuditLogEntry[] = [];
  return {
    rows,
    create: jest.fn((data: Partial<AuditLogEntry>) => ({
      id: `a-${rows.length + 1}`,
      createdAt: new Date(),
      ...data,
    })),
    save: jest.fn(async (e: AuditLogEntry) => {
      rows.push({ ...e });
      return e;
    }),
    find: jest.fn(async ({ where }: any) => {
      return rows
        .filter((r) =>
          Object.entries(where).every(([k, v]) => (r as any)[k] === v),
        )
        .reverse();
    }),
  };
}

describe('AuditLogService', () => {
  let service: AuditLogService;
  let repo: any;

  beforeEach(async () => {
    repo = makeRepo();
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getRepositoryToken(AuditLogEntry), useValue: repo },
      ],
    }).compile();
    service = moduleRef.get(AuditLogService);
  });

  it('writes a row with sane defaults', async () => {
    const row = await service.write({
      actorId: 'u1',
      aggregateType: 'deal',
      aggregateId: 'd1',
      action: 'deal.created',
    });
    expect(row).not.toBeNull();
    expect(repo.rows).toHaveLength(1);
    expect(repo.rows[0].details).toEqual({});
  });

  it('returns null and does not throw when the underlying save fails', async () => {
    repo.save.mockRejectedValue(new Error('db down'));
    const row = await service.write({
      aggregateType: 'deal',
      aggregateId: 'd1',
      action: 'deal.created',
    });
    expect(row).toBeNull();
  });

  it('lists rows by aggregate', async () => {
    await service.write({
      aggregateType: 'deal',
      aggregateId: 'd1',
      action: 'deal.created',
    });
    await service.write({
      aggregateType: 'deal',
      aggregateId: 'd2',
      action: 'deal.created',
    });
    const list = await service.findByAggregate('deal', 'd1');
    expect(list).toHaveLength(1);
    expect(list[0].aggregateId).toBe('d1');
  });

  it('lists rows by actor', async () => {
    await service.write({
      actorId: 'u1',
      aggregateType: 'deal',
      aggregateId: 'd1',
      action: 'deal.created',
    });
    await service.write({
      actorId: 'u2',
      aggregateType: 'deal',
      aggregateId: 'd2',
      action: 'deal.created',
    });
    const list = await service.findByActor('u1');
    expect(list).toHaveLength(1);
    expect(list[0].actorId).toBe('u1');
  });
});
