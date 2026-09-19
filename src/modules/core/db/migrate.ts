import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

import { env } from '../env';

// Пуска се при deploy, ПРЕДИ новия образ да поеме трафик. Идемпотентен.
const sql = postgres(env().DATABASE_URL, { max: 1 });

try {
  await migrate(drizzle(sql), { migrationsFolder: './drizzle' });
  console.log('migrations: up to date');
} finally {
  await sql.end();
}
