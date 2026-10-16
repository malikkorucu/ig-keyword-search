import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('keywords')
@Unique('UQ_keywords_normalized', ['normalized'])
export class KeywordEntity {
  @PrimaryGeneratedColumn('uuid', { primaryKeyConstraintName: 'PK_keywords' })
  id: string;

  @Column({ type: 'varchar', length: 100 })
  value: string;

  /** Turkish-lowercased form; unique so "Alanya" and "ALANYA" cannot both exist. */
  @Column({ type: 'varchar', length: 100 })
  normalized: string;

  @Column({ type: 'boolean', default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
