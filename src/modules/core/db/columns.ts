// Общи колони за всички таблици. Внасят се ОТНОСИТЕЛНО от схемите — през
// barrel-а на `core` се цикли (виж `schema.ts`).

import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

// `uuidv7()` е нативна в PostgreSQL 18: сортируема по време, без генерация в
// приложението.
export const primaryId = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`);

export const createdAt = () =>
  timestamp('created_at', { withTimezone: true, mode: 'date' })
    .notNull()
    .defaultNow();
