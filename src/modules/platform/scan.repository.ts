// Достъп до `scans` — единственият SQL за таблицата. Четенето е по `scans.org_id`
// (фиксиран при скана), не през `cards`: препродадена карта не носи чужда история.

import { and, count, desc, eq, gte, isNotNull, sql } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { profiles } from './profile.schema';
import {
  type NewScan,
  type ScanDevice,
  scans,
  type ScanSource,
} from './scan.schema';
import { SCAN_TIME_ZONE } from './scan-days';

export async function insertScan(
  executor: DbExecutor,
  values: NewScan,
): Promise<void> {
  await executor.insert(scans).values(values);
}

const ofOrg = (orgId: string) => eq(scans.orgId, orgId);

const ZONE_SQL = sql.raw(`'${SCAN_TIME_ZONE}'`);

/** `YYYY-MM-DD` по София — същият ключ като `localDay` в кода. */
const localDaySql = sql<string>`to_char(${scans.scannedAt} at time zone ${ZONE_SQL}, 'YYYY-MM-DD')`;

/** `since` е груб праг за индекса; `fromDay` е точната локална граница. */
export interface ScanWindow {
  readonly since: Date;
  readonly fromDay: string;
}

const inWindow = (orgId: string, { since, fromDay }: ScanWindow) =>
  and(ofOrg(orgId), gte(scans.scannedAt, since), gte(localDaySql, fromDay));

export async function countScansByOrg(
  executor: DbExecutor,
  orgId: string,
  since?: Date,
): Promise<number> {
  const rows = await executor
    .select({ total: count() })
    .from(scans)
    .where(
      since === undefined
        ? ofOrg(orgId)
        : and(ofOrg(orgId), gte(scans.scannedAt, since)),
    );
  return rows[0]?.total ?? 0;
}

/** Ден по София като `YYYY-MM-DD`; дните без сканове липсват — сервизът ги пълни. */
export async function countScansByDay(
  executor: DbExecutor,
  orgId: string,
  since: Date,
): Promise<{ day: string; count: number }[]> {
  return executor
    .select({ day: localDaySql.as('day'), count: count() })
    .from(scans)
    .where(and(ofOrg(orgId), gte(scans.scannedAt, since)))
    .groupBy(sql`day`)
    .orderBy(sql`day`);
}

export function countScansByDevice(
  executor: DbExecutor,
  orgId: string,
  window: ScanWindow,
): Promise<{ device: ScanDevice; count: number }[]> {
  return executor
    .select({ device: scans.device, count: count() })
    .from(scans)
    .where(inWindow(orgId, window))
    .groupBy(scans.device)
    .orderBy(desc(count()));
}

export function countScansBySource(
  executor: DbExecutor,
  orgId: string,
  window: ScanWindow,
): Promise<{ source: ScanSource; count: number }[]> {
  return executor
    .select({ source: scans.source, count: count() })
    .from(scans)
    .where(inWindow(orgId, window))
    .groupBy(scans.source)
    .orderBy(desc(count()), scans.source);
}

export interface ProfileScanRow {
  readonly profileId: string | null;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly count: number;
}

/** Профилът в момента на скана; изтрит → `null` (set null). */
export function countScansByProfile(
  executor: DbExecutor,
  orgId: string,
  window: ScanWindow,
): Promise<ProfileScanRow[]> {
  return (
    executor
      .select({
        profileId: scans.profileId,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        count: count(),
      })
      .from(scans)
      // И профилът е на org-а: прехвърлен профил не бива да носи чужди имена.
      .leftJoin(
        profiles,
        and(eq(profiles.id, scans.profileId), eq(profiles.orgId, orgId)),
      )
      .where(inWindow(orgId, window))
      .groupBy(scans.profileId, profiles.firstName, profiles.lastName)
      .orderBy(desc(count()))
  );
}

/** Само чипът има карта — QR и линкът не влизат в класацията. */
export function countScansByCard(
  executor: DbExecutor,
  orgId: string,
  window: ScanWindow,
  limit: number,
): Promise<{ cardId: string; count: number }[]> {
  return executor
    .select({ cardId: sql<string>`${scans.cardId}`, count: count() })
    .from(scans)
    .where(and(inWindow(orgId, window), isNotNull(scans.cardId)))
    .groupBy(scans.cardId)
    .orderBy(desc(count()), scans.cardId)
    .limit(limit);
}
