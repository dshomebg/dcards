'use client';

import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { useId, useState } from 'react';

import { cn } from '@/lib/cn';

type CollapsibleSectionProps = Readonly<{
  title: string;
  /** Колко филтъра в секцията са попълнени — вижда се и когато е сгъната. */
  count?: number;
  defaultOpen?: boolean;
  children: ReactNode;
}>;

/**
 * Сгъваема секция на страничен панел (`OPS-32`). Различна от `useCollapsible`:
 * там се мери ВИСОЧИНА на дълъг текст, тук човекът крие цяла група контроли.
 * Заглавието е бутон, не `<details>` — родният не приема брояч до името.
 */
export function CollapsibleSection({
  title,
  count = 0,
  defaultOpen = true,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section className="border-border border-b pb-3 last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className="flex w-full items-center justify-between gap-2 py-2 text-left text-sm font-medium"
      >
        <span className="flex items-center gap-2">
          {title}
          {count > 0 && (
            <span className="bg-brand text-brand-contrast min-w-5 rounded-full px-1.5 text-center text-xs font-semibold leading-5">
              {count}
            </span>
          )}
        </span>
        <ChevronDown
          aria-hidden
          size={16}
          className={cn(
            'text-text-muted transition-transform',
            open && 'rotate-180',
          )}
        />
      </button>

      {/* Скрито, не размонтирано: полетата пазят фокус и състояние при сгъване. */}
      <div id={bodyId} hidden={!open} className="flex flex-col gap-field pt-1">
        {children}
      </div>
    </section>
  );
}
