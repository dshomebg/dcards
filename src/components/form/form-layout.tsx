'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { useFirstErrorFocus } from '@/hooks/use-first-error-focus';
import { cn } from '@/lib/cn';

type FormLayoutProps = Readonly<{
  title: string;
  back: { href: string; label: string };
  /** Общата грешка. Едно място за нея — иначе всяка форма избира свое. */
  error?: string | null;
  fieldErrors?: Record<string, string[]>;
  /**
   * Един ред под заглавието — какво прави екранът, не какво е.
   *
   * Незадължителен: списък и настройки нямат какво да добавят, а подзаглавие,
   * което преразказва заглавието, е шум (`ADM-11` § 5.5).
   */
  subtitle?: string;
  actions: ReactNode;
  children: ReactNode;
}>;

/**
 * Съдържанието е ВЛЯВО, до навигацията, без таван за ширина: центрирано с
 * таван оставяше половин широк монитор бял отляво.
 */
const COLUMN = 'w-full px-8';

/** Един и същ обект при всяко рендиране — иначе ефектът се пуска всеки път. */
const NO_FIELD_ERRORS: Record<string, string[]> = {};

/**
 * Обвивката на формуляр — заглавие, връзка назад, секции, лента с действия.
 * Поема ОБВИВКАТА, не състоянието: образец, който налага Zod или hook, чупи
 * другата форма. Странична колона тук няма — тя е вътре в таба, където важи.
 */
export function FormLayout({
  title,
  back,
  error,
  fieldErrors,
  subtitle,
  actions,
  children,
}: FormLayoutProps) {
  const contentRef = useFirstErrorFocus(fieldErrors ?? NO_FIELD_ERRORS);

  return (
    // Превъртана област и лента с действия ПОД нея: лентата изтласква
    // съдържанието, иначе последният екран от формата остава завинаги под нея.
    <main className="flex h-full flex-col">
      {/* Лентата за превъртане е по РЪБА на областта, не по ръба на колоната —
          затова ширината се ограничава едно ниво навътре. */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={cn(COLUMN, 'flex flex-col gap-6 py-8')}>
          <div className="flex flex-col gap-hint">
            <Link
              href={back.href}
              className="text-text-muted text-sm hover:underline"
            >
              {back.label}
            </Link>
            <h1 className="text-2xl font-semibold">{title}</h1>
            {subtitle !== undefined && (
              <p className="text-text-muted text-sm">{subtitle}</p>
            )}
          </div>

          <div ref={contentRef} className="flex flex-col gap-8">
            {children}
          </div>

          {error != null && (
            <p role="alert" className="text-danger text-sm">
              {error}
            </p>
          )}
        </div>
      </div>

      <div className={cn(COLUMN, 'shrink-0')}>{actions}</div>
    </main>
  );
}
