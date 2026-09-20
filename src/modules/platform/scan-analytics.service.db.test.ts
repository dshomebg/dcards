import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { seedCard, seedOrg } from './card-activation.db-fixtures';
import { organizations } from './organization.schema';
import { deleteProfile } from './profile-edit.service';
import { insertScan } from './scan.repository';
import type { ScanSource } from './scan.schema';
import { getScanAnalytics } from './scan-analytics.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

const NOW = new Date('2026-09-20T10:00:00Z');

interface ScanInput {
  readonly orgId: string;
  readonly cardId?: string | null;
  readonly profileId: string | null;
  readonly at: string;
  readonly source?: ScanSource;
  readonly device?: 'ios' | 'android' | 'other';
}

async function scan(input: ScanInput) {
  await insertScan(db, {
    cardId: input.cardId ?? null,
    profileId: input.profileId,
    orgId: input.orgId,
    scannedAt: new Date(input.at),
    source: input.source ?? (input.cardId ? 'nfc' : 'direct'),
    device: input.device ?? 'ios',
  });
}

describe('getScanAnalytics', () => {
  it('free sees only totals; pro sees the breakdown; other orgs never leak', async () => {
    const mine = await seedOrg('anl-mine');
    const other = await seedOrg('anl-other');
    const card = await seedCard(mine.userId, 'active', mine.org.id);
    const card2 = await seedCard(mine.userId, 'active', mine.org.id);
    const foreign = await seedCard(other.userId, 'active', other.org.id);

    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-09-20T09:00:00Z',
    });
    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-09-19T20:30:00Z',
      device: 'android',
    });
    // 23:30 UTC на 13-и е 02:30 на 14-и по София → в прозореца от 7 дни.
    await scan({
      orgId: mine.org.id,
      cardId: card2.id,
      profileId: mine.profile.id,
      at: '2026-09-13T23:30:00Z',
    });
    await scan({
      orgId: mine.org.id,
      cardId: card2.id,
      profileId: mine.profile.id,
      at: '2026-09-13T20:00:00Z',
    }); // 13-и → извън 7, в 30
    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-08-01T10:00:00Z',
    }); // извън 30
    await scan({
      orgId: other.org.id,
      cardId: foreign.id,
      profileId: other.profile.id,
      at: '2026-09-20T09:00:00Z',
    });

    const free = await getScanAnalytics(db, mine.org, NOW);
    expect(free).toEqual({ tier: 'free', total: 5, last7: 3 });

    await db
      .update(organizations)
      .set({ plan: 'pro', planExpiresAt: null })
      .where(eq(organizations.id, mine.org.id));
    const pro = await getScanAnalytics(db, { ...mine.org, plan: 'pro' }, NOW);
    if (pro.tier !== 'pro') throw new Error('expected pro');
    expect(pro.total).toBe(5);
    expect(pro.last7).toBe(3);
    expect(pro.last30).toBe(4);
    expect(pro.byDay).toHaveLength(30);
    expect(pro.byDay.reduce((s, d) => s + d.count, 0)).toBe(4);
    expect(pro.byDay.find((d) => d.day === '2026-09-14')?.count).toBe(1);
    expect(pro.byDay.find((d) => d.day === '2026-09-13')?.count).toBe(1);
    expect(pro.byDevice).toEqual([
      { device: 'ios', count: 3 },
      { device: 'android', count: 1 },
    ]);
    expect(pro.bySource).toEqual([{ source: 'nfc', count: 4 }]);
    expect(pro.byProfile).toEqual([{ name: 'Иван Петров', count: 4 }]);
    expect(pro.topCards).toEqual(
      [
        { cardId: card.id, count: 2 },
        { cardId: card2.id, count: 2 },
      ].sort((a, b) => a.cardId.localeCompare(b.cardId)),
    );

    // Изтекъл Pro е Free — през `can()`.
    const expired = await getScanAnalytics(
      db,
      { ...mine.org, plan: 'pro', planExpiresAt: new Date('2026-09-01') },
      NOW,
    );
    expect(expired.tier).toBe('free');

    // Точно след полунощ по София: сканът от 23:00 UTC е в „днес" и в 7-те дни.
    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-09-20T23:00:00Z',
    });
    const midnight = await getScanAnalytics(
      db,
      { ...mine.org, plan: 'pro' },
      new Date('2026-09-20T23:30:00Z'),
    );
    if (midnight.tier !== 'pro') throw new Error('expected pro');
    expect(midnight.byDay.at(-1)).toEqual({ day: '2026-09-21', count: 1 });
    expect(midnight.last7).toBe(3); // 14-и по София излиза от прозореца 15–21
    // Разбивките са по същия прозорец като стълбовете.
    expect(midnight.byDevice.reduce((s, d) => s + d.count, 0)).toBe(
      midnight.last30,
    );
  });

  it('counts scans of a deleted profile under a null name', async () => {
    const mine = await seedOrg('anl-deleted');
    const card = await seedCard(mine.userId, 'active', mine.org.id);
    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-09-20T09:00:00Z',
    });
    await deleteProfile(db, mine.org.id, mine.profile.id);

    const pro = await getScanAnalytics(db, { ...mine.org, plan: 'pro' }, NOW);
    if (pro.tier !== 'pro') throw new Error('expected pro');
    expect(pro.total).toBe(1);
    expect(pro.byProfile).toEqual([{ name: null, count: 1 }]);
  });

  it('counts qr and direct opens without a card, only for their own org', async () => {
    const mine = await seedOrg('anl-src-mine');
    const other = await seedOrg('anl-src-other');
    const card = await seedCard(mine.userId, 'active', mine.org.id);
    const p = (source: ScanSource, at: string, org = mine) =>
      scan({ orgId: org.org.id, profileId: org.profile.id, at, source });

    await scan({
      orgId: mine.org.id,
      cardId: card.id,
      profileId: mine.profile.id,
      at: '2026-09-20T09:00:00Z',
    });
    await p('qr', '2026-09-20T08:00:00Z');
    await p('qr', '2026-09-19T08:00:00Z');
    await p('direct', '2026-09-18T08:00:00Z');
    await p('qr', '2026-09-20T08:00:00Z', other);
    await p('direct', '2026-09-20T08:00:00Z', other);

    const pro = await getScanAnalytics(db, { ...mine.org, plan: 'pro' }, NOW);
    if (pro.tier !== 'pro') throw new Error('expected pro');
    expect(pro.total).toBe(4);
    expect(pro.last30).toBe(4);
    expect(pro.bySource).toEqual([
      { source: 'qr', count: 2 },
      { source: 'nfc', count: 1 },
      { source: 'direct', count: 1 },
    ]);
    expect(pro.bySource.reduce((s, r) => s + r.count, 0)).toBe(pro.last30);
    expect(pro.byProfile).toEqual([{ name: 'Иван Петров', count: 4 }]);
    // Без карта няма ред в класацията на картите.
    expect(pro.topCards).toEqual([{ cardId: card.id, count: 1 }]);

    const foreign = await getScanAnalytics(
      db,
      { ...other.org, plan: 'pro' },
      NOW,
    );
    if (foreign.tier !== 'pro') throw new Error('expected pro');
    expect(foreign.total).toBe(2);
    expect(foreign.topCards).toEqual([]);
  });

  it('keeps a qr scan after the profile is deleted', async () => {
    const mine = await seedOrg('anl-src-deleted');
    await scan({
      orgId: mine.org.id,
      profileId: mine.profile.id,
      at: '2026-09-20T09:00:00Z',
      source: 'qr',
    });
    await deleteProfile(db, mine.org.id, mine.profile.id);

    const pro = await getScanAnalytics(db, { ...mine.org, plan: 'pro' }, NOW);
    if (pro.tier !== 'pro') throw new Error('expected pro');
    expect(pro.total).toBe(1);
    expect(pro.byProfile).toEqual([{ name: null, count: 1 }]);
    expect(pro.bySource).toEqual([{ source: 'qr', count: 1 }]);
  });

  it('rejects nfc without a card and qr with a card (CHECK)', async () => {
    const mine = await seedOrg('anl-check');
    const card = await seedCard(mine.userId, 'active', mine.org.id);
    await expect(
      scan({
        orgId: mine.org.id,
        profileId: mine.profile.id,
        at: '2026-09-20T09:00:00Z',
        source: 'nfc',
      }),
    ).rejects.toThrow();
    await expect(
      scan({
        orgId: mine.org.id,
        cardId: card.id,
        profileId: mine.profile.id,
        at: '2026-09-20T09:00:00Z',
        source: 'qr',
      }),
    ).rejects.toThrow();
  });
});
