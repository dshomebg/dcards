// Сканирания (zadanie § 5.4): чип, QR или директен линк — кога, откъде, на
// какво устройство. Без IP и без суров UA — статистиката не иска лични данни.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { primaryId } from '../core/db/columns';
import { cards } from './card.schema';
import { organizations } from './organization.schema';
import { profiles } from './profile.schema';

export const SCAN_SOURCES = ['nfc', 'qr', 'direct'] as const;
export type ScanSource = (typeof SCAN_SOURCES)[number];
export const scanSourceEnum = pgEnum('scan_source', SCAN_SOURCES);

export const SCAN_DEVICES = ['ios', 'android', 'other'] as const;
export type ScanDevice = (typeof SCAN_DEVICES)[number];
export const scanDeviceEnum = pgEnum('scan_device', SCAN_DEVICES);

// `sql.raw` — иначе drizzle-kit оставя `$1` в миграцията вместо литерал.
const COUNTRY_PATTERN_SQL = sql.raw(`'^[A-Z]{2}$'`);
const NFC_SQL = sql.raw(`'nfc'`);

export const scans = pgTable(
  'scans',
  {
    id: primaryId(),
    // Само чипът има карта; QR и линкът стигат до профила без нея.
    cardId: text('card_id').references(() => cards.id, {
      onDelete: 'restrict',
    }),
    // Изтрит профил оставя сканирането — историята на картата е нейна.
    profileId: uuid('profile_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    // Org-ът се фиксира в момента на скана: препродадена карта не носи чужда история.
    orgId: uuid('org_id').references(() => organizations.id, {
      onDelete: 'set null',
    }),
    scannedAt: timestamp('scanned_at', { withTimezone: true, mode: 'date' })
      .notNull()
      .defaultNow(),
    source: scanSourceEnum('source').notNull(),
    device: scanDeviceEnum('device').notNull(),
    // ISO 3166-1 alpha-2; `null` докато няма proxy, който да го подава (INF-4).
    country: text('country'),
  },
  (table) => [
    index('scans_card_time_idx').on(table.cardId, table.scannedAt),
    index('scans_profile_time_idx').on(table.profileId, table.scannedAt),
    index('scans_org_time_idx').on(table.orgId, table.scannedAt),
    check(
      'scans_country_format',
      sql`${table.country} ~ ${COUNTRY_PATTERN_SQL}`,
    ),
    check(
      'scans_source_card',
      sql`(${table.source} = ${NFC_SQL}) = (${table.cardId} IS NOT NULL)`,
    ),
  ],
);

export type Scan = typeof scans.$inferSelect;
export type NewScan = typeof scans.$inferInsert;
