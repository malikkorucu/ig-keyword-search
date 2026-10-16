import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('telegram_chats')
@Unique('UQ_telegram_chats_chat_id', ['chatId'])
export class TelegramChatEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_telegram_chats' })
  id: string;

  /** Numeric id ("-100…" for channels/groups) or "@publicchannel". */
  @Column({ name: 'chat_id', type: 'varchar', length: 64 })
  chatId: string;

  @Column({ type: 'varchar', length: 100, default: '' })
  label: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
