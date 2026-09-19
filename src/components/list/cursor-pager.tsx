'use client';

import Link from 'next/link';

import { CURSOR_PARAM } from '@/hooks/query-params';
import { useQueryParams } from '@/hooks/use-query-params';

/*
  Пагинацията е курсорна, затова има само „напред". Скок на страница 47 не
  съществува нарочно: при 200 000 продукта той изисква OFFSET, който кара
  базата да прочете и изхвърли всичко преди него.
*/
export function CursorPager({
  nextCursor,
  label = 'Следващи →',
}: Readonly<{ nextCursor: string | null; label?: string }>) {
  const { hrefWith } = useQueryParams();

  if (nextCursor === null) return null;

  return (
    <div className="flex justify-end">
      {/* Адресът се строи от ПЪЛНИЯ текущ адрес, не само от курсора — иначе
          прелистването изхвърля активния филтър. */}
      <Link
        href={hrefWith({ [CURSOR_PARAM]: nextCursor })}
        className="rounded-(--radius-control) border border-border px-4 py-2 text-sm hover:bg-surface-muted"
      >
        {label}
      </Link>
    </div>
  );
}
