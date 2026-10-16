import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { MatchesQuery, MatchStatus, Paginated } from '@igw/shared';
import { MoreThanOrEqual, Repository } from 'typeorm';
import { MatchRepository } from '../../../application/ports';
import type { Match, NewMatch } from '../../../domain/models';
import { MatchEntity } from '../entities';
import { toMatch } from './mappers';

@Injectable()
export class TypeOrmMatchRepository extends MatchRepository {
  constructor(@InjectRepository(MatchEntity) private readonly repo: Repository<MatchEntity>) {
    super();
  }

  async create(match: NewMatch): Promise<Match | null> {
    const result = await this.repo
      .createQueryBuilder()
      .insert()
      .values({ ...match, status: 'new' })
      .orIgnore()
      .returning('id')
      .execute();
    const id = (result.raw as Array<{ id: string }>)[0]?.id;
    if (!id) return null;
    return toMatch(await this.repo.findOneByOrFail({ id }));
  }

  async list(query: MatchesQuery): Promise<Paginated<Match>> {
    const qb = this.repo.createQueryBuilder('m');
    if (query.accountId) qb.andWhere('m.account_id = :accountId', { accountId: query.accountId });
    if (query.keyword) qb.andWhere(':keyword = ANY(m.keywords)', { keyword: query.keyword });
    if (query.source) qb.andWhere('m.source = :source', { source: query.source });
    if (query.status) qb.andWhere('m.status = :status', { status: query.status });
    if (query.from) qb.andWhere('m.detected_at >= :from', { from: new Date(query.from) });
    if (query.to) qb.andWhere('m.detected_at <= :to', { to: new Date(query.to) });
    qb.orderBy('m.detected_at', 'DESC')
      .skip((query.page - 1) * query.pageSize)
      .take(query.pageSize);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map(toMatch), total, page: query.page, pageSize: query.pageSize };
  }

  async updateStatus(id: string, status: MatchStatus): Promise<Match | null> {
    const result = await this.repo.update({ id }, { status });
    if (!result.affected) return null;
    return toMatch(await this.repo.findOneByOrFail({ id }));
  }

  countDetectedSince(since: Date): Promise<number> {
    return this.repo.countBy({ detectedAt: MoreThanOrEqual(since) });
  }

  countByStatus(status: MatchStatus): Promise<number> {
    return this.repo.countBy({ status });
  }
}
