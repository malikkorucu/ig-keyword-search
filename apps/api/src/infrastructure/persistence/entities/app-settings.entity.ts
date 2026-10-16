import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Single-row table (id = 1) holding every runtime-tunable business setting. */
@Entity('app_settings')
export class AppSettingsEntity {
  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'PK_app_settings' })
  id: number;

  @Column({ name: 'poll_interval_minutes', type: 'int' })
  pollIntervalMinutes: number;

  @Column({ name: 'media_limit', type: 'int' })
  mediaLimit: number;

  @Column({ name: 'ocr_enabled', type: 'boolean' })
  ocrEnabled: boolean;

  @Column({ name: 'token_refresh_threshold_days', type: 'int' })
  tokenRefreshThresholdDays: number;

  @Column({ name: 'rate_limit_pause_minutes', type: 'int' })
  rateLimitPauseMinutes: number;

  @Column({ name: 'poll_suspended_until', type: 'timestamptz', nullable: true })
  pollSuspendedUntil: Date | null;

  @Column({ name: 'poll_suspend_reason', type: 'text', nullable: true })
  pollSuspendReason: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
