import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { CreateAccountInput } from '@igw/shared';
import { Repository } from 'typeorm';
import { DuplicateError } from '../../../application/errors';
import { AccountRepository } from '../../../application/ports';
import type { Account } from '../../../domain/models';
import { AccountEntity } from '../entities';
import { isUniqueViolation, toAccount } from './mappers';

@Injectable()
export class TypeOrmAccountRepository extends AccountRepository {
  constructor(@InjectRepository(AccountEntity) private readonly repo: Repository<AccountEntity>) {
    super();
  }

  async findPollable(): Promise<Account[]> {
    const rows = await this.repo.find({
      where: { active: true, accessible: true },
      order: { username: 'ASC' },
    });
    return rows.map(toAccount);
  }

  async findById(id: string): Promise<Account | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? toAccount(row) : null;
  }

  async list(): Promise<Account[]> {
    return (await this.repo.find({ order: { username: 'ASC' } })).map(toAccount);
  }

  async create(input: CreateAccountInput): Promise<Account> {
    try {
      return toAccount(await this.repo.save(this.repo.create({ username: input.username })));
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateError(`@${input.username} zaten ekli`);
      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<Account | null> {
    const result = await this.repo.update({ id }, { active });
    return result.affected ? this.findById(id) : null;
  }

  async delete(id: string): Promise<boolean> {
    return ((await this.repo.delete({ id })).affected ?? 0) > 0;
  }

  async markPolled(id: string, at: Date): Promise<void> {
    await this.repo.update({ id }, { lastPolledAt: at, lastError: null });
  }

  async markAccessible(id: string, at: Date): Promise<void> {
    await this.repo.update(
      { id },
      { accessible: true, inaccessibleReason: null, lastError: null, lastCheckedAt: at },
    );
  }

  async markInaccessible(id: string, reason: string, at: Date): Promise<void> {
    await this.repo.update(
      { id },
      { accessible: false, inaccessibleReason: reason, lastError: reason, lastCheckedAt: at },
    );
  }

  async recordError(id: string, error: string, at: Date): Promise<void> {
    await this.repo.update({ id }, { lastError: error, lastCheckedAt: at });
  }

  async countByState(): Promise<{ active: number; inaccessible: number }> {
    const [active, inaccessible] = await Promise.all([
      this.repo.countBy({ active: true, accessible: true }),
      this.repo.countBy({ accessible: false }),
    ]);
    return { active, inaccessible };
  }
}
