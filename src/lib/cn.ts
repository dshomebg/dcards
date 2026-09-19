import { type ClassValue, clsx } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

/**
 * `tailwind-merge` не знае нашите именувани стойности: без списъка
 * `cn('gap-2', 'gap-hint')` оставя и двата класа. Допълва се при всеки нов
 * ИМЕНУВАН клас от `theme/tokens.css`; цветовете се разпознават и без него.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      spacing: ['hint', 'field', 'block', 'section', 'control'],
      // `--radius-*` ражда `rounded-control` и `rounded-card`. Без тях
      // `cn('rounded-md', 'rounded-card')` оставяше и двата класа.
      radius: ['control', 'card'],
      // `--text-*` ражда `text-label` и `text-hint` (`ADM-11` етап 1). Те са
      // в същата група като `text-sm`, тоест без записа `cn('text-sm',
      // 'text-label')` оставя двата и размерът зависи от реда в CSS-а.
      text: ['label', 'hint'],
    },
  },
});

/** Слива Tailwind класове — при конфликт печели по-късният, не редът в CSS-а. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
