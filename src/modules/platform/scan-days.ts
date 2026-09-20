// Календарни дни по `Europe/Sofia` — продуктът е локален, зоната е константа.
// Чиста функция: зеро-запълва прозореца, за да няма липсващи стълбове.

export const SCAN_TIME_ZONE = 'Europe/Sofia';

const dayKey = new Intl.DateTimeFormat('en-CA', {
  timeZone: SCAN_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** `YYYY-MM-DD` по София за даден момент. */
export function localDay(at: Date): string {
  return dayKey.format(at);
}

export interface DayCount {
  readonly day: string;
  readonly count: number;
}

/** Обяд UTC на ЛОКАЛНИЯ ден на `now` — след полунощ по София UTC датата още е вчера. */
export function localNoon(now: Date): Date {
  return new Date(`${localDay(now)}T12:00:00Z`);
}

/**
 * Последните `days` дни до `now` включително, всеки с брой (0 при липса).
 * Стъпката е 24 h от обяд, за да не прескача ден при смяна на лятно време.
 */
export function fillDays(
  counts: ReadonlyMap<string, number>,
  now: Date,
  days: number,
): DayCount[] {
  const noon = localNoon(now);
  const result: DayCount[] = [];
  for (let back = days - 1; back >= 0; back -= 1) {
    const day = localDay(new Date(noon.getTime() - back * 86_400_000));
    result.push({ day, count: counts.get(day) ?? 0 });
  }
  return result;
}

export const sumCounts = (rows: readonly DayCount[]): number =>
  rows.reduce((sum, row) => sum + row.count, 0);
