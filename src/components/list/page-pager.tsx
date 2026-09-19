'use client';

/**
 * Номерирани страници (`SEO-12` § 3.5) — за списъци с прелистване по НОМЕР,
 * където въпросът е „кои са", а не „докъде съм слязъл". Курсорният пейджър
 * остава за големите таблици; този е за няколкостотин реда.
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { cn } from '@/lib/cn';

type Props = Readonly<{
  page: number;
  pageCount: number;
  disabled: boolean;
  onPage: (page: number) => void;
}>;

const STEP =
  'flex size-8 items-center justify-center rounded-(--radius-control) border border-border text-sm disabled:opacity-40';

/** Пропуск в редицата от номера — рисува се като многоточие, не като бутон. */
export const PAGE_GAP = 'gap';

const PAGE_WINDOW = 2;

/**
 * Първата, последната и прозорец около текущата: без прозореца триста страници
 * дават триста бутона; без първата и последната скокът до края е по един.
 */
export function pageNumbers(
  page: number,
  pageCount: number,
): (number | typeof PAGE_GAP)[] {
  const wanted = new Set<number>([1, pageCount]);
  for (let step = page - PAGE_WINDOW; step <= page + PAGE_WINDOW; step += 1) {
    if (step >= 1 && step <= pageCount) wanted.add(step);
  }

  const shown = [...wanted].sort((a, b) => a - b);
  const result: (number | typeof PAGE_GAP)[] = [];
  for (const [index, number] of shown.entries()) {
    const previous = shown[index - 1];
    if (previous !== undefined && number - previous > 1) result.push(PAGE_GAP);
    result.push(number);
  }

  return result;
}

function PageButton({
  number,
  current,
  disabled,
  onPage,
}: Readonly<{
  number: number;
  current: boolean;
  disabled: boolean;
  onPage: (page: number) => void;
}>) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Страница ${String(number)}`}
      aria-current={current ? 'page' : undefined}
      onClick={() => {
        onPage(number);
      }}
      className={cn(
        STEP,
        'tabular-nums',
        current && 'bg-brand text-brand-contrast border-brand',
      )}
    >
      {number}
    </button>
  );
}

export function PagePager({ page, pageCount, disabled, onPage }: Props) {
  // Една страница не се прелиства — редица от един бутон е шум.
  if (pageCount <= 1) return null;

  return (
    <nav aria-label="Страници на списъка" className="flex flex-wrap gap-1.5">
      <button
        type="button"
        disabled={disabled || page <= 1}
        aria-label="Предишна страница"
        onClick={() => {
          onPage(page - 1);
        }}
        className={STEP}
      >
        <ChevronLeft aria-hidden size={16} />
      </button>

      {pageNumbers(page, pageCount).map((entry, index) =>
        entry === PAGE_GAP ? (
          <span
            // Многоточието няма своя стойност — ключът е мястото му в редицата.
            key={`${PAGE_GAP}-${String(index)}`}
            aria-hidden
            className="text-text-muted flex size-8 items-center justify-center text-sm"
          >
            …
          </span>
        ) : (
          <PageButton
            key={entry}
            number={entry}
            current={entry === page}
            disabled={disabled}
            onPage={onPage}
          />
        ),
      )}

      <button
        type="button"
        disabled={disabled || page >= pageCount}
        aria-label="Следваща страница"
        onClick={() => {
          onPage(page + 1);
        }}
        className={STEP}
      >
        <ChevronRight aria-hidden size={16} />
      </button>
    </nav>
  );
}
