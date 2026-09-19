import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { env } from '../env';
import * as schema from './schema';

// Един пул за процеса. `globalThis` пази от втори пул при HMR в dev.
const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
};

const sql = globalForDb.sql ?? postgres(env().DATABASE_URL, { max: 10 });
if (process.env.NODE_ENV !== 'production') globalForDb.sql = sql;

export const db = drizzle(sql, { schema });
export type Db = typeof db;

/** База ИЛИ транзакция — репозиториите го приемат първи, за да делят една с чужди. */
export type DbExecutor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];
