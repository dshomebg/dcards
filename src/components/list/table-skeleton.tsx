import { cardStyles } from '../ui/surface';

type TableSkeletonProps = Readonly<{
  columns: number;
  /** Толкова, колкото е лимитът на страницата — иначе височината подскача. */
  rows: number;
}>;

function range(count: number): readonly number[] {
  return Array.from({ length: count }, (_, index) => index);
}

/** Заместител, докато сървърният списък се зарежда. */
export function TableSkeleton({ columns, rows }: TableSkeletonProps) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        Списъкът се зарежда.
      </p>

      <div aria-hidden="true" className={cardStyles('flex flex-col gap-3 p-4')}>
        {range(rows).map((row) => (
          <div key={row} className="flex gap-4">
            {range(columns).map((column) => (
              <div
                key={column}
                className="h-4 flex-1 animate-pulse rounded-(--radius-control) bg-surface-muted"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
