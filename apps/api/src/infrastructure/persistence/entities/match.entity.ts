import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AccountEntity } from './account.entity';

@Entity('matches')
@Unique('UQ_matches_post_id', ['postId'])
export class MatchEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_matches' })
  id: string;

  @Column({ name: 'post_id', type: 'varchar', length: 64 })
  postId: string;

  @Index('IDX_matches_account_id')
  @Column({ name: 'account_id', type: 'uuid', nullable: true })
  accountId: string | null;

  @ManyToOne(() => AccountEntity, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'account_id', foreignKeyConstraintName: 'FK_matches_account' })
  account?: AccountEntity | null;

  /** Snapshot, so matches stay readable after the account is deleted. */
  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Index('IDX_matches_keywords', { synchronize: false })
  @Column({ type: 'text', array: true })
  keywords: string[];

  /** text | image */
  @Column({ type: 'varchar', length: 8 })
  source: string;

  @Column({ type: 'text' })
  snippet: string;

  @Column({ name: 'ocr_text', type: 'text', nullable: true })
  ocrText: string | null;

  @Column({ type: 'text' })
  permalink: string;

  @Column({ name: 'posted_at', type: 'timestamptz' })
  postedAt: Date;

  @Index('IDX_matches_detected_at')
  @Column({ name: 'detected_at', type: 'timestamptz' })
  detectedAt: Date;

  /** new | seen | dismissed */
  @Index('IDX_matches_status')
  @Column({ type: 'varchar', length: 16, default: 'new' })
  status: string;
}
