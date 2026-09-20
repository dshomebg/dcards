import { BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';

import { ListState } from '@/components/list';
import { Badge } from '@/components/ui/badge';
import { cardStyles } from '@/components/ui/surface';
import { db } from '@/modules/core';
import {
  getScanAnalytics,
  type ProScanAnalytics,
  type ScanDevice,
  type ScanSource,
} from '@/modules/platform';

import { requireCurrent } from '../current';
import { ScanChart } from './scan-chart';

export const metadata: Metadata = { title: 'Статистика' };

const DEVICE_LABELS: Readonly<Record<ScanDevice, string>> = {
  ios: 'iPhone',
  android: 'Android',
  other: 'Друго',
};

const SOURCE_LABELS: Readonly<Record<ScanSource, string>> = {
  nfc: 'Чип',
  qr: 'QR',
  direct: 'Линк',
};

function Tile({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <div className={cardStyles('flex flex-col gap-1 px-5 py-4')}>
      <span className="text-text-muted text-sm">{label}</span>
      <span className="text-3xl font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: Readonly<{
  title: string;
  rows: readonly { label: string; count: number; muted?: boolean }[];
}>) {
  return (
    <section className={cardStyles('flex flex-col gap-3 px-5 py-4')}>
      <h2 className="font-medium">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-text-muted text-sm">Няма сканирания за периода.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((row, index) => (
            <li key={index} className="flex justify-between gap-4">
              <span className={row.muted ? 'text-text-muted italic' : ''}>
                {row.label}
              </span>
              <span className="tabular-nums">{row.count}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ProSections({ stats }: Readonly<{ stats: ProScanAnalytics }>) {
  if (stats.last30 === 0) {
    return (
      <ListState
        icon={BarChart3}
        title="Още няма сканирания"
        hint="Допри карта до телефон — числата се появяват веднага."
      />
    );
  }
  return (
    <>
      <section className={cardStyles('flex flex-col gap-3 px-5 py-4')}>
        <h2 className="font-medium">По дни (последните 30)</h2>
        <ScanChart days={stats.byDay} />
      </section>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Breakdown
          title="По източник"
          rows={stats.bySource.map((row) => ({
            label: SOURCE_LABELS[row.source],
            count: row.count,
          }))}
        />
        <Breakdown
          title="По устройство"
          rows={stats.byDevice.map((row) => ({
            label: DEVICE_LABELS[row.device],
            count: row.count,
          }))}
        />
        <Breakdown
          title="По профил"
          rows={stats.byProfile.map((row) => ({
            label: row.name ?? 'изтрит профил',
            count: row.count,
            muted: row.name === null,
          }))}
        />
        <Breakdown
          title="Най-сканирани карти"
          rows={stats.topCards.map((row) => ({
            label: row.cardId,
            count: row.count,
          }))}
        />
      </div>
    </>
  );
}

export default async function AnalyticsPage() {
  const { org } = await requireCurrent();
  const stats = await getScanAnalytics(db, org);

  return (
    <main className="flex flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">Статистика</h1>

      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
        <Tile label="Общо сканирания" value={stats.total} />
        <Tile label="Последните 7 дни" value={stats.last7} />
        {stats.tier === 'pro' && (
          <Tile label="Последните 30 дни" value={stats.last30} />
        )}
      </div>

      {stats.tier === 'pro' ? (
        <ProSections stats={stats} />
      ) : (
        <section className={cardStyles('flex flex-col gap-2 px-5 py-4')}>
          <div className="flex items-center gap-2">
            <h2 className="font-medium">Подробна статистика</h2>
            <Badge tone="brand">Pro</Badge>
          </div>
          <p className="text-text-muted text-sm">
            Разбивката по дни, източник, устройства, профили и карти е част от
            Pro.
          </p>
        </section>
      )}
    </main>
  );
}
