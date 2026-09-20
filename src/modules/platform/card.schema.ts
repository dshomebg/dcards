// Партиди и карти (zadanie § 5.3). Картата е вечен физически носител: партида с
// карти не се трие, а изтрит профил я оставя в организацията неразпределена.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { users } from '../auth/user.schema';
import { createdAt, primaryId } from '../core/db/columns';
import { CARD_ID_PATTERN } from './card-id';
import { organizations } from './organization.schema';
import { profiles } from './profile.schema';

export const CARD_STATUSES = [
  'blank',
  'written',
  'assigned',
  'active',
  'disabled',
] as const;

export type CardStatus = (typeof CARD_STATUSES)[number];

export const cardStatusEnum = pgEnum('card_status', CARD_STATUSES);

export const cardBatches = pgTable('card_batches', {
  id: primaryId(),
  name: text('name').notNull(),
  quantity: integer('quantity').notNull(),
  createdBy: uuid('created_by')
    .notNull()
    .references(() => users.id, { onDelete: 'restrict' }),
  createdAt: createdAt(),
});

export type CardBatch = typeof cardBatches.$inferSelect;
export type NewCardBatch = typeof cardBatches.$inferInsert;

// `sql.raw` — иначе drizzle-kit оставя `$1` в миграцията вместо литерал.
const CARD_ID_PATTERN_SQL = sql.raw(`'${CARD_ID_PATTERN.source}'`);
// Изричен клас вместо `\d`: миграцията е литерал и не бива да се преписва.
const ACTIVATION_CODE_PATTERN_SQL = sql.raw(`'^[0-9]{6}$'`);

const nullableTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: 'date' });

export const cards = pgTable(
  'cards',
  {
    // Публичният id е самият ключ — не uuid (DAT-3).
    id: text('id').primaryKey(),
    batchId: uuid('batch_id')
      .notNull()
      .references(() => cardBatches.id, { onDelete: 'restrict' }),
    // В чист вид: печата се върху картата; защитата е лимитът при активация.
    activationCode: text('activation_code').notNull(),
    status: cardStatusEnum('status').notNull().default('blank'),
    orgId: uuid('org_id').references(() => organizations.id, {
      onDelete: 'restrict',
    }),
    profileId: uuid('profile_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    // Без FK към `orders` — магазинът може да липсва (ARC-2); целостта е в app-слоя.
    orderId: uuid('order_id'),
    writtenAt: nullableTimestamp('written_at'),
    activatedAt: nullableTimestamp('activated_at'),
  },
  (table) => [
    index('cards_status_idx').on(table.status),
    index('cards_batch_idx').on(table.batchId),
    index('cards_org_idx').on(table.orgId),
    index('cards_profile_idx').on(table.profileId),
    index('cards_order_idx').on(table.orderId),
    uniqueIndex('cards_batch_code_idx').on(table.batchId, table.activationCode),
    check('cards_id_format', sql`${table.id} ~ ${CARD_ID_PATTERN_SQL}`),
    check(
      'cards_code_format',
      sql`${table.activationCode} ~ ${ACTIVATION_CODE_PATTERN_SQL}`,
    ),
  ],
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
