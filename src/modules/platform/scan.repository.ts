// Достъп до `scans` — единственият SQL за таблицата. Само запис в този етап;
// четенето (`/app/analytics`) е етап 4.

import type { DbExecutor } from '@/modules/core';

import { type NewScan, scans } from './scan.schema';

export async function insertScan(
  executor: DbExecutor,
  values: NewScan,
): Promise<void> {
  await executor.insert(scans).values(values);
}
