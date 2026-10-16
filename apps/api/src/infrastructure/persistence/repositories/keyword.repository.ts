import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DuplicateError } from '../../../application/errors';
import { KeywordRepository } from '../../../application/ports';
import type { Keyword } from '../../../domain/models';
import { normalizeKeyword } from '../../../domain/text-normalizer';
import { KeywordEntity } from '../entities';
import { isUniqueViolation, toKeyword } from './mappers';

@Injectable()
export class TypeOrmKeywordRepository extends KeywordRepository {
  constructor(@InjectRepository(KeywordEntity) private readonly repo: Repository<KeywordEntity>) {
    super();
  }

  async findActiveValues(): Promise<string[]> {
    const rows = await this.repo.find({ where: { active: true }, order: { createdAt: 'ASC' } });
    return rows.map((r) => r.value);
  }

  async list(): Promise<Keyword[]> {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toKeyword);
  }

  async create(value: string): Promise<Keyword> {
    const trimmed = value.trim();
    try {
      return toKeyword(
        await this.repo.save(
          this.repo.create({ value: trimmed, normalized: normalizeKeyword(trimmed) }),
        ),
      );
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateError(`"${trimmed}" zaten var`);
      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<Keyword | null> {
    const result = await this.repo.update({ id }, { active });
    if (!result.affected) return null;
    return toKeyword(await this.repo.findOneByOrFail({ id }));
  }

  async delete(id: string): Promise<boolean> {
    return ((await this.repo.delete({ id })).affected ?? 0) > 0;
  }
}
