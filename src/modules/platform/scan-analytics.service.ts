// Статистика за dashboard-а. Гейтът е ТУК: за Free Pro-заявките не се изпълняват,
// така HTML-ът физически няма данните (не е скриване с CSS).

import type { DbExecutor } from '@/modules/core';

import { can, type PlanFields } from './plan';
import {
  countScansByCard,
  countScansByDay,
  countScansByDevice,
  countScansByOrg,
  countScansByProfile,
  countScansBySource,
} from './scan.repository';
import type { ScanDevice, ScanSource } from './scan.schema';
import { type DayCount, fillDays, localNoon, sumCounts } from './scan-days';

const WINDOW_DAYS = 30;
const TOP_CARDS = 5;

export interface FreeScanAnalytics {
  readonly tier: 'free';
  readonly total: number;
  readonly last7: number;
}

export interface ProScanAnalytics {
  readonly tier: 'pro';
  readonly total: number;
  readonly last7: number;
  readonly last30: number;
  readonly byDay: readonly DayCount[];
  readonly byDevice: readonly { device: ScanDevice; count: number }[];
  readonly bySource: readonly { source: ScanSource; count: number }[];
  /** `name` е `null` за изтрит профил. */
  readonly byProfile: readonly { name: string | null; count: number }[];
  readonly topCards: readonly { cardId: string; count: number }[];
}

export type ScanAnalytics = FreeScanAnalytics | ProScanAnalytics;

/**
 * Груб долен праг за индекса: ден отгоре, защото местният ден започва преди
 * UTC обяд. Точната граница е `fromDay` (ключ по София) в самите заявки.
 */
function windowStart(now: Date, days: number): Date {
  return new Date(localNoon(now).getTime() - days * 86_400_000);
}

export async function getScanAnalytics(
  executor: DbExecutor,
  org: PlanFields & { readonly id: string },
  now = new Date(),
): Promise<ScanAnalytics> {
  const since = windowStart(now, WINDOW_DAYS);
  const [total, dayRows] = await Promise.all([
    countScansByOrg(executor, org.id),
    countScansByDay(executor, org.id, since),
  ]);
  const byDay = fillDays(
    new Map(dayRows.map((row) => [row.day, row.count])),
    now,
    WINDOW_DAYS,
  );
  const last7 = sumCounts(byDay.slice(-7));
  if (!can(org, 'analytics', 0, now)) return { tier: 'free', total, last7 };

  const window = { since, fromDay: byDay[0]?.day ?? '' };
  const [byDevice, bySource, profileRows, topCards] = await Promise.all([
    countScansByDevice(executor, org.id, window),
    countScansBySource(executor, org.id, window),
    countScansByProfile(executor, org.id, window),
    countScansByCard(executor, org.id, window, TOP_CARDS),
  ]);
  return {
    tier: 'pro',
    total,
    last7,
    last30: sumCounts(byDay),
    byDay,
    byDevice,
    bySource,
    byProfile: profileRows.map((row) => ({
      name: row.profileId === null ? null : `${row.firstName} ${row.lastName}`,
      count: row.count,
    })),
    topCards,
  };
}
