import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TokenRepository } from '../../../application/ports';
import type { TokenState } from '../../../domain/models';
import { ApiTokenEntity } from '../entities';
import { toToken } from './mappers';

const ROW_ID = 1;

@Injectable()
export class TypeOrmTokenRepository extends TokenRepository {
  constructor(@InjectRepository(ApiTokenEntity) private readonly repo: Repository<ApiTokenEntity>) {
    super();
  }

  async get(): Promise<TokenState | null> {
    const row = await this.repo.findOneBy({ id: ROW_ID });
    return row ? toToken(row) : null;
  }

  async initialize(accessToken: string, expiresAt: Date | null): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .insert()
      .values({ id: ROW_ID, accessToken, expiresAt })
      .orIgnore()
      .execute();
  }

  async saveRefreshed(accessToken: string, expiresAt: Date | null, at: Date): Promise<void> {
    await this.repo.update(
      { id: ROW_ID },
      {
        accessToken,
        expiresAt,
        lastRefreshedAt: at,
        lastRefreshAttemptAt: at,
        lastRefreshError: null,
      },
    );
  }

  async recordRefreshFailure(error: string, at: Date): Promise<void> {
    await this.repo.update({ id: ROW_ID }, { lastRefreshAttemptAt: at, lastRefreshError: error });
  }

  async setExpiry(expiresAt: Date | null): Promise<void> {
    await this.repo.update({ id: ROW_ID }, { expiresAt });
  }
}
