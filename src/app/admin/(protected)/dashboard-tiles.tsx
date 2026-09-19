import Link from 'next/link';
import type { ReactNode } from 'react';

import { cardStyles } from '@/components/ui/surface';

/** Брояч без число (`null`) значи „екранът предстои", не нула. */
export interface DashboardCounter {
  readonly count: number | null;
  readonly href: string | null;
}

export interface DashboardView {
  readonly orders: DashboardCounter;
  readonly cards: DashboardCounter;
  readonly customers: DashboardCounter;
  readonly shop: DashboardCounter;
  readonly settings: DashboardCounter;
}

const TILE = 'flex flex-col gap-hint p-5 hover:bg-surface-muted';

const PENDING = 'Предстои';

type TileProps = Readonly<{ label: string; counter: DashboardCounter }>;

type WrapProps = Readonly<{ href: string | null; children: ReactNode }>;

/** Един обвиващ елемент, защото „с адрес" и „без адрес" се редуват по данни. */
const Wrap = ({ href, children }: WrapProps) =>
  href === null ? (
    <div className={cardStyles(TILE)}>{children}</div>
  ) : (
    <Link href={href} className={cardStyles(TILE)}>
      {children}
    </Link>
  );

// Нулата се ПОКАЗВА: скрита плочка кара човека да гадае дали няма работа.
function Tile({ label, counter }: TileProps) {
  return (
    <Wrap href={counter.href}>
      <span className="text-text-muted text-sm">{label}</span>

      {counter.count === null ? (
        <span className="text-brand text-sm font-medium">{PENDING}</span>
      ) : (
        <span className="text-2xl font-semibold tabular-nums">
          {counter.count}
        </span>
      )}
    </Wrap>
  );
}

export function DashboardTiles({ view }: Readonly<{ view: DashboardView }>) {
  return (
    <div className="grid gap-block sm:grid-cols-2 wide:grid-cols-3">
      <Tile label="Поръчки" counter={view.orders} />
      <Tile label="Карти" counter={view.cards} />
      <Tile label="Клиенти" counter={view.customers} />
      <Tile label="Магазин" counter={view.shop} />
      <Tile label="Настройки" counter={view.settings} />
    </div>
  );
}
