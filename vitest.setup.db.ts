// Изолация на ВСЕКИ тестов файл: своя база, копирана от мигрирания образец.
//
// Изпълнява се ПРЕДИ модулите на теста — точно затова работи: `core/db/client`
// чете `DATABASE_URL` при импорт. Тук не се внася нищо от `src/`.

import { randomUUID } from 'node:crypto';
import { env } from 'node:process';
import { setTimeout as sleep } from 'node:timers/promises';

import postgres from 'postgres';

import {
  databaseUrl,
  MAINTENANCE_DATABASE_URL,
  TEMPLATE_DATABASE,
} from './vitest.env.js';

// Случайно име, не брояч: vitest връща `process.env` между файловете.
const database = `${TEMPLATE_DATABASE}_${randomUUID().replaceAll('-', '')}`;

/** Копирането пада с 55006, ако някой е в образеца точно сега — изчаква се. */
async function cloneTemplate(): Promise<void> {
  const sql = postgres(MAINTENANCE_DATABASE_URL, {
    max: 1,
    onnotice: () => {},
  });
  try {
    for (let attempt = 1; ; attempt += 1) {
      try {
        await sql`CREATE DATABASE ${sql(database)} TEMPLATE ${sql(TEMPLATE_DATABASE)}`;
        return;
      } catch (error) {
        if (attempt === 5) throw error;
        await sleep(100 * attempt);
      }
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

await cloneTemplate();
env.DATABASE_URL = databaseUrl(database);
