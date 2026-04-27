import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, FindOptionsWhere, Repository } from 'typeorm';
import { AuditLogEntry } from './entities/audit-log.entity';

export interface AuditWriteInput {
  actorId?: string | null;
  actorRole?: string | null;
  aggregateType: string;
  aggregateId: string;
  action: string;
  details?: Record<string, unknown>;
  manager?: EntityManager;
}

/**
 * Append-only audit log. Failures to write the log MUST NOT crash the
 * underlying business operation — we log + swallow. Use a transactional
 * `manager` to ensure the audit row commits atomically with the business
 * write when the operation is sensitive (admin actions, slashing, etc.).
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLogEntry)
    private readonly repo: Repository<AuditLogEntry>,
  ) {}

  async write(input: AuditWriteInput): Promise<AuditLogEntry | null> {
    try {
      const repo = input.manager
        ? input.manager.getRepository(AuditLogEntry)
        : this.repo;
      const row = repo.create({
        actorId: input.actorId ?? null,
        actorRole: input.actorRole ?? null,
        aggregateType: input.aggregateType,
        aggregateId: input.aggregateId,
        action: input.action,
        details: input.details ?? {},
      });
      return await repo.save(row);
    } catch (err) {
      // Never let an audit failure cascade. Log loudly so we notice.
      this.logger.error(
        `Audit write failed for ${input.aggregateType}/${input.aggregateId} action=${input.action}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async findByAggregate(
    aggregateType: string,
    aggregateId: string,
    limit = 100,
  ): Promise<AuditLogEntry[]> {
    return this.repo.find({
      where: { aggregateType, aggregateId } as FindOptionsWhere<AuditLogEntry>,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async findByActor(actorId: string, limit = 100): Promise<AuditLogEntry[]> {
    return this.repo.find({
      where: { actorId } as FindOptionsWhere<AuditLogEntry>,
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
