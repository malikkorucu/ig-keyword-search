import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Paginated, PollRunsQuery, PollTrigger } from '@igw/shared';
import { LessThan, MoreThan, Repository } from 'typeorm';
import { PollRunRepository } from '../../../application/ports';
import type { PollRun, PollRunError, PollRunResult } from '../../../domain/models';
import { PollRunEntity } from '../entities';
import { toPollRun } from './mappers';

/** Keep jsonb rows bounded even if every account fails with a long message. */
const MAX_STORED_ERRORS = 200;

@Injectable()
export class TypeOrmPollRunRepository extends PollRunRepository {
  constructor(@InjectRepository(PollRunEntity) private readonly repo: Repository<PollRunEntity>) {
    super();
  }

  async start(trigger: PollTrigger, startedAt: Date): Promise<string> {
    const row = await this.repo.save(
      this.repo.create({ trigger, startedAt, status: 'running', errors: [] }),
    );
    return row.id;
  }

  async finish(id: string, r: PollRunResult): Promise<void> {
    await this.repo.update(
      { id },
      {
        status: r.status,
        finishedAt: r.finishedAt,
        accountsScanned: r.accountsScanned,
        postsScanned: r.postsScanned,
        newPosts: r.newPosts,
        matchesFound: r.matchesFound,
        ocrJobsEnqueued: r.ocrJobsEnqueued,
        errorCount: r.errors.length,
        errors: r.errors.slice(0, MAX_STORED_ERRORS),
        note: r.note,
      },
    );
  }

  async latest(): Promise<PollRun | null> {
    const row = await this.repo.findOne({ where: {}, order: { startedAt: 'DESC' } });
    return row ? toPollRun(row) : null;
  }

  async list(query: PollRunsQuery): Promise<Paginated<PollRun>> {
    const [rows, total] = await this.repo.findAndCount({
      order: { startedAt: 'DESC' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
    });
    return { items: rows.map(toPollRun), total, page: query.page, pageSize: query.pageSize };
  }

  async recentErrors(limit: number): Promise<Array<PollRunError & { at: Date }>> {
    const rows = await this.repo.find({
      where: { errorCount: MoreThan(0) },
      order: { startedAt: 'DESC' },
      take: limit,
    });
    return rows.flatMap((r) => r.errors.map((e) => ({ ...e, at: r.startedAt }))).slice(0, limit);
  }

  async failStale(olderThan: Date, at: Date): Promise<number> {
    const result = await this.repo.update(
      { status: 'running', startedAt: LessThan(olderThan) },
      { status: 'failed', finishedAt: at, note: 'Worker poll tamamlanmadan durdu' },
    );
    return result.affected ?? 0;
  }
}
