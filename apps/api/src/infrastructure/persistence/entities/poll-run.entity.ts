import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import type { PollRunError } from '../../../domain/models';

@Entity('poll_runs')
export class PollRunEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_poll_runs' })
  id: string;

  /** cron | manual */
  @Column({ type: 'varchar', length: 16 })
  trigger: string;

  /** running | success | partial | failed | skipped */
  @Column({ type: 'varchar', length: 16 })
  status: string;

  @Index('IDX_poll_runs_started_at')
  @Column({ name: 'started_at', type: 'timestamptz' })
  startedAt: Date;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  @Column({ name: 'accounts_scanned', type: 'int', default: 0 })
  accountsScanned: number;

  @Column({ name: 'posts_scanned', type: 'int', default: 0 })
  postsScanned: number;

  @Column({ name: 'new_posts', type: 'int', default: 0 })
  newPosts: number;

  @Column({ name: 'matches_found', type: 'int', default: 0 })
  matchesFound: number;

  @Column({ name: 'ocr_jobs_enqueued', type: 'int', default: 0 })
  ocrJobsEnqueued: number;

  @Column({ name: 'error_count', type: 'int', default: 0 })
  errorCount: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  errors: PollRunError[];

  @Column({ type: 'text', nullable: true })
  note: string | null;
}
