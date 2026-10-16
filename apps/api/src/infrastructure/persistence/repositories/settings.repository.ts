import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { UpdateSettingsInput } from '@igw/shared';
import { Repository } from 'typeorm';
import { SettingsRepository } from '../../../application/ports';
import type { Settings } from '../../../domain/models';
import { AppSettingsEntity } from '../entities';
import { toSettings } from './mappers';

const ROW_ID = 1;

@Injectable()
export class TypeOrmSettingsRepository extends SettingsRepository {
  constructor(
    @InjectRepository(AppSettingsEntity) private readonly repo: Repository<AppSettingsEntity>,
  ) {
    super();
  }

  async get(): Promise<Settings> {
    return toSettings(await this.repo.findOneByOrFail({ id: ROW_ID }));
  }

  async update(patch: UpdateSettingsInput): Promise<Settings> {
    await this.repo.update({ id: ROW_ID }, patch);
    return this.get();
  }

  async suspendPolling(until: Date, reason: string): Promise<void> {
    await this.repo.update(
      { id: ROW_ID },
      { pollSuspendedUntil: until, pollSuspendReason: reason },
    );
  }

  async clearSuspension(): Promise<void> {
    await this.repo.update({ id: ROW_ID }, { pollSuspendedUntil: null, pollSuspendReason: null });
  }
}
