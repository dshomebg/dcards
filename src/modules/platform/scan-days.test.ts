import { describe, expect, it } from 'vitest';

import { fillDays, localDay, sumCounts } from './scan-days';

describe('localDay', () => {
  it('uses Sofia calendar days: 23:30 UTC in summer is the next day', () => {
    expect(localDay(new Date('2026-07-10T23:30:00Z'))).toBe('2026-07-11');
    expect(localDay(new Date('2026-01-10T22:30:00Z'))).toBe('2026-01-11');
    expect(localDay(new Date('2026-01-10T21:30:00Z'))).toBe('2026-01-10');
  });
});

describe('fillDays', () => {
  it('fills a 30-day window ending today with zeros, oldest first', () => {
    const now = new Date('2026-09-20T10:00:00Z');
    const days = fillDays(
      new Map([
        ['2026-09-20', 3],
        ['2026-09-01', 1],
      ]),
      now,
      30,
    );
    expect(days).toHaveLength(30);
    expect(days[0]).toEqual({ day: '2026-08-22', count: 0 });
    expect(days.at(-1)).toEqual({ day: '2026-09-20', count: 3 });
    expect(days.find((d) => d.day === '2026-09-01')?.count).toBe(1);
    expect(sumCounts(days)).toBe(4);
  });

  it('ends on the Sofia day, not the UTC day, just after local midnight', () => {
    const days = fillDays(
      new Map([['2026-09-21', 1]]),
      new Date('2026-09-20T23:30:00Z'),
      7,
    );
    expect(days.at(-1)).toEqual({ day: '2026-09-21', count: 1 });
  });

  it('does not skip or repeat a day across the DST switch', () => {
    // 2026-10-25 е смяната на часа в Европа.
    const days = fillDays(new Map(), new Date('2026-10-28T02:00:00Z'), 7);
    expect(days.map((d) => d.day)).toEqual([
      '2026-10-22',
      '2026-10-23',
      '2026-10-24',
      '2026-10-25',
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
    ]);
  });
});
