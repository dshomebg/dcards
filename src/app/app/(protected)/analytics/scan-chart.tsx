// Сървърен SVG — 30 стълба не оправдават chart библиотека в dashboard без JS.

import type { DayCount } from '@/modules/platform';

const WIDTH = 600;
const HEIGHT = 160;
const GAP = 4;

const dayLabel = new Intl.DateTimeFormat('bg-BG', {
  day: 'numeric',
  month: 'short',
});

const labelOf = (day: string) => dayLabel.format(new Date(`${day}T12:00:00Z`));

export function ScanChart({ days }: Readonly<{ days: readonly DayCount[] }>) {
  const max = Math.max(0, ...days.map((row) => row.count));
  const barWidth = (WIDTH - GAP * (days.length - 1)) / Math.max(days.length, 1);
  const first = days[0];
  const last = days.at(-1);
  const summary =
    first === undefined || last === undefined
      ? 'Няма данни.'
      : `Сканирания по дни от ${labelOf(first.day)} до ${labelOf(last.day)}, най-много ${max} на ден.`;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT + 4}`}
      role="img"
      preserveAspectRatio="none"
      aria-label={summary}
      className="h-40 w-full"
    >
      {days.map((row, index) => {
        // При max 0 всички стълбове са плоска ос, не деление на нула.
        const height = max === 0 ? 0 : (row.count / max) * HEIGHT;
        const x = index * (barWidth + GAP);
        return (
          <rect
            key={row.day}
            x={x}
            y={HEIGHT - height}
            width={barWidth}
            height={Math.max(height, 2)}
            rx={2}
            className={row.count === 0 ? 'fill-border' : 'fill-brand'}
          >
            <title>{`${labelOf(row.day)}: ${row.count}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
