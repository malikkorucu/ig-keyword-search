import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ProcessedPostRepository } from '../../../application/ports';
import type { OcrStatus, ProcessedPostRecord } from '../../../domain/models';
import { ProcessedPostEntity } from '../entities';

@Injectable()
export class TypeOrmProcessedPostRepository extends ProcessedPostRepository {
  constructor(
    @InjectRepository(ProcessedPostEntity) private readonly repo: Repository<ProcessedPostEntity>,
  ) {
    super();
  }

  async findExistingIds(postIds: string[]): Promise<Set<string>> {
    if (postIds.length === 0) return new Set();
    const rows = await this.repo.find({ select: { postId: true }, where: { postId: In(postIds) } });
    return new Set(rows.map((r) => r.postId));
  }

  async save(record: ProcessedPostRecord): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({
        postId: record.postId,
        accountId: record.accountId,
        postedAt: record.postedAt,
        matched: record.matched,
        ocrStatus: record.ocrStatus,
      })
      .orIgnore()
      .execute();
  }

  async updateOcrStatus(postId: string, status: OcrStatus, matched: boolean): Promise<void> {
    await this.repo.update({ postId }, { ocrStatus: status, matched });
  }
}
