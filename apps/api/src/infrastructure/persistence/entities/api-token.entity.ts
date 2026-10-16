import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

/** Single-row table (id = 1): current long-lived user token. Seeded from IG_ACCESS_TOKEN on first start. */
@Entity('api_token')
export class ApiTokenEntity {
  @PrimaryColumn({ type: 'smallint', primaryKeyConstraintName: 'PK_api_token' })
  id: number;

  @Column({ name: 'access_token', type: 'text' })
  accessToken: string;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'last_refreshed_at', type: 'timestamptz', nullable: true })
  lastRefreshedAt: Date | null;

  @Column({ name: 'last_refresh_attempt_at', type: 'timestamptz', nullable: true })
  lastRefreshAttemptAt: Date | null;

  @Column({ name: 'last_refresh_error', type: 'text', nullable: true })
  lastRefreshError: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
