// Таблица `users` — идентичността живее в `auth`: имейл, хеш, `is_admin`.
// Платформата сочи насам през външен ключ, но не вижда `password_hash`.

import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { createdAt, primaryId } from '../core/db/columns';

export const users = pgTable(
  'users',
  {
    id: primaryId(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    emailVerifiedAt: timestamp('email_verified_at', {
      withTimezone: true,
      mode: 'date',
    }),
    isAdmin: boolean('is_admin').notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [
    // Уникалност без оглед на регистъра — обикновен UNIQUE би допуснал
    // „Ivan@x.bg" и „ivan@x.bg" като два акаунта.
    uniqueIndex('users_email_lower_idx').on(sql`lower(${table.email})`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/** Каквото може да напусне модула — изброено изрично, не `Omit`. */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly emailVerifiedAt: Date | null;
  readonly isAdmin: boolean;
  readonly createdAt: Date;
}

// При „всичко без passwordHash" всяко бъдещо чувствително поле би изтекло по
// подразбиране.
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    emailVerifiedAt: user.emailVerifiedAt,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
  };
}
