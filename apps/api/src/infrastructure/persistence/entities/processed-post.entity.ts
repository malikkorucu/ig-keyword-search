import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity('processed_posts')
export class ProcessedPostEntity {
  /** Instagram media id. */
  @PrimaryColumn({
    name: 'post_id',
    type: 'varchar',
    length: 64,
    primaryKeyConstraintName: 'PK_processed_posts',
  })
  postId: string;

  @Index('IDX_processed_posts_account_id')
  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_processed_posts_account' })
  account?: AccountEntity | null;

  @Column({ name: 'posted_at', type: 'timestamptz' })
  postedAt: Date;

  @Column({ type: 'boolean', default: false })
  matched: boolean;

  /** skipped | pending | done | failed */
  @Column({ name: 'ocr_status', type: 'varchar', length: 16 })
  ocrStatus: string;

  @CreateDateColumn({ name: 'processed_at', type: 'timestamptz' })
  processedAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
