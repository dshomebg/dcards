import type { ReactNode } from 'react';

import { cardStyles } from '../ui/surface';

/** Лента с филтрите на списъчен екран. Само подредба — стойностите са в адреса. */
export function FilterBar({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div
      role="search"
      className={cardStyles('flex flex-wrap items-end gap-4 p-4')}
    >
      {children}
    </div>
  );
}
