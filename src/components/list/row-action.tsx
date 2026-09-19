import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/cn';

type RowActionProps = Readonly<{
  href: string;
  icon: LucideIcon;
  label: string;
  /** Разрушително действие. Оцветява се, останалите остават неутрални. */
  danger?: boolean;
}>;

/**
 * Действие в ред от таблица — ЕДНОТО място за правилото „разрушителното е
 * червено, останалото не". Иконката е задължителна: в ред думите се четат
 * вертикално, а знакът се разпознава без четене; надписът остава до нея.
 */
export function RowAction({ href, icon: Icon, label, danger }: RowActionProps) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center gap-hint rounded-(--radius-control)',
        'px-2 py-1 text-sm font-medium transition-colors hover:bg-surface-muted',
        danger === true && 'text-danger',
      )}
    >
      <Icon aria-hidden size={16} />
      {label}
    </Link>
  );
}
