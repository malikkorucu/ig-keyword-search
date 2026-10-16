import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('accounts')
@Unique('UQ_accounts_username', ['username'])
export class AccountEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_accounts' })
  id: string;

  @Column({ type: 'varchar', length: 30 })
  username: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  /** false = business_discovery cannot read it (not business / private / unknown); skipped by polls. */
  @Column({ type: 'boolean', default: true })
  accessible: boolean;

  @Column({ name: 'inaccessible_reason', type: 'text', nullable: true })
  inaccessibleReason: string | null;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @Column({ name: 'last_checked_at', type: 'timestamptz', nullable: true })
  lastCheckedAt: Date | null;

  @Column({ name: 'last_polled_at', type: 'timestamptz', nullable: true })
  lastPolledAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
