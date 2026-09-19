import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cardStyles } from '../ui/surface';

type ListStateProps = Readonly<{
  /**
   * Иконката е ПО ИЗБОР нарочно: празният екран без нея си остава верен, а
   * екраните приемат дизайн системата един по един (`ADM-10` § 2).
   */
  icon?: LucideIcon;
  title: string;
  hint?: string;
  action?: ReactNode;
}>;

/**
 * Съобщение вместо таблица. Празно, празно след филтър и незаредило не се
 * сливат — всяко иска различно действие. Носи знак, изречение и изход: ред
 * сив текст е грешка, не покана.
 */
export function ListState({ icon: Icon, title, hint, action }: ListStateProps) {
  return (
    <div
      className={cardStyles(
        'flex flex-col items-center gap-hint px-6 py-10 text-center',
      )}
    >
      {Icon !== undefined && (
        // Приглушена и голяма: тя е знак за мястото, не действие. Ярка иконка
        // на празен екран изглежда като бутон, който не се натиска.
        <Icon
          aria-hidden
          size={36}
          strokeWidth={1.25}
          className="text-text-muted mb-1"
        />
      )}

      <p className="font-medium">{title}</p>

      {hint !== undefined && (
        <p className="text-text-muted max-w-sm text-sm">{hint}</p>
      )}

      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  );
}
