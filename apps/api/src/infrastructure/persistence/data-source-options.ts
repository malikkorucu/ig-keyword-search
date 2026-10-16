import type { DataSourceOptions } from 'typeorm';
import { ENTITIES } from './entities';
import { MIGRATIONS } from './migrations';

export function buildDataSourceOptions(databaseUrl: string, ssl: boolean): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    ssl: ssl ? { rejectUnauthorized: false } : false,
    entities: ENTITIES,
    migrations: MIGRATIONS,
    synchronize: false,
    // Store and read timestamps in UTC regardless of the server/session timezone.
    extra: { options: '-c timezone=UTC' },
  };
}
