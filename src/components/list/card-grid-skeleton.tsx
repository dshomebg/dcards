import { cardStyles } from '../ui/surface';

/**
 * Заместител за екран с РЕШЕТКА от карти — брат на `TableSkeleton`, не негов
 * вариант: таблицата се зарежда като редове, а решетката като плочки, и скелет
 * с чужда форма подскача при появата на истинското.
 */
export function CardGridSkeleton({ cards }: Readonly<{ cards: number }>) {
  return (
    <div className="flex flex-col gap-2">
      <p role="status" className="sr-only">
        Списъкът се зарежда.
      </p>

      <div
        aria-hidden="true"
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"
      >
        {Array.from({ length: cards }, (_, index) => index).map((card) => (
          <div key={card} className={cardStyles('flex flex-col gap-3 p-5')}>
            <div className="h-4 w-1/2 animate-pulse rounded-(--radius-control) bg-surface-muted" />
            <div className="h-3 w-3/4 animate-pulse rounded-(--radius-control) bg-surface-muted" />
            <div className="h-3 w-1/3 animate-pulse rounded-(--radius-control) bg-surface-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
