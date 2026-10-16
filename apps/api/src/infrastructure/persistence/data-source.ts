import 'dotenv/config';
import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from './data-source-options';

/** CLI-only DataSource for `pnpm migration:*`. The app builds its own via TypeOrmModule. */
const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is not set');

export default new DataSource(
  buildDataSourceOptions(
    url,
    process.env.DATABASE_SSL === 'true' || process.env.DATABASE_SSL === '1',
  ),
);
