import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DuplicateError } from '../../../application/errors';
import { TelegramChatRepository } from '../../../application/ports';
import type { TelegramChat } from '../../../domain/models';
import { TelegramChatEntity } from '../entities';
import { isUniqueViolation } from './mappers';

const toChat = (e: TelegramChatEntity): TelegramChat => ({
  id: e.id,
  chatId: e.chatId,
  label: e.label,
  active: e.active,
  lastError: e.lastError,
  lastSentAt: e.lastSentAt,
  createdAt: e.createdAt,
});

@Injectable()
export class TypeOrmTelegramChatRepository extends TelegramChatRepository {
  constructor(
    @InjectRepository(TelegramChatEntity) private readonly repo: Repository<TelegramChatEntity>,
  ) {
    super();
  }

  async list(): Promise<TelegramChat[]> {
    return (await this.repo.find({ order: { createdAt: 'ASC' } })).map(toChat);
  }

  async findActive(): Promise<TelegramChat[]> {
    return (await this.repo.find({ where: { active: true }, order: { createdAt: 'ASC' } })).map(
      toChat,
    );
  }

  async findById(id: string): Promise<TelegramChat | null> {
    const row = await this.repo.findOneBy({ id });
    return row ? toChat(row) : null;
  }

  async create(chatId: string, label: string): Promise<TelegramChat> {
    try {
      return toChat(await this.repo.save(this.repo.create({ chatId, label })));
    } catch (error) {
      if (isUniqueViolation(error)) throw new DuplicateError(`${chatId} zaten ekli`);
      throw error;
    }
  }

  async setActive(id: string, active: boolean): Promise<TelegramChat | null> {
    const result = await this.repo.update({ id }, { active });
    return result.affected ? this.findById(id) : null;
  }

  async delete(id: string): Promise<boolean> {
    return ((await this.repo.delete({ id })).affected ?? 0) > 0;
  }

  async recordResult(id: string, error: string | null, at: Date): Promise<void> {
    await this.repo.update(
      { id },
      error ? { lastError: error } : { lastError: null, lastSentAt: at },
    );
  }
}
