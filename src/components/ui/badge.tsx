import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

export type BadgeTone =
  'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info';

type BadgeProps = Readonly<{
  tone?: BadgeTone;
  /**
   * Иконка на СЪСТОЯНИЕТО, не украса. Значката е единственото място, където
   * цветът носи смисъл сам по себе си — а всеки дванайсети мъж не различава
   * зелено от червено. Иконката повтаря съобщението във втори канал.
   */
  icon?: LucideIcon;
  className?: string;
  children: ReactNode;
}>;

/**
 * Подложката и мастилото са РАЗЛИЧНИ токени: `bg-<тон>/15` плюс `text-<тон>`
 * даваше надпис със същата светлина като подложката и слаб контраст.
 */
const TONES: Record<BadgeTone, string> = {
  neutral: 'bg-surface-muted text-text-muted',
  // ⚠ `brand` не е СЪСТОЯНИЕ, а роля: „това е избраното". Мери се 5.62
  // (`design.md` § „Контраст"), тоест няма нужда от свой `-ink`.
  brand: 'bg-brand-subtle text-brand',
  success: 'bg-success-subtle text-success-ink',
  warning: 'bg-warning-subtle text-warning-ink',
  danger: 'bg-danger-subtle text-danger-ink',
  info: 'bg-info-subtle text-info-ink',
};

export function Badge({
  tone = 'neutral',
  icon: Icon,
  className,
  children,
}: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-hint rounded-full px-2 py-0.5 text-xs',
        TONES[tone],
        className,
      )}
    >
      {/* `aria-hidden`: надписът до нея вече казва същото, а прочетено два
          пъти състояние звучи като две различни състояния. */}
      {Icon !== undefined && <Icon aria-hidden size={14} strokeWidth={2.25} />}
      {children}
    </span>
  );
}
