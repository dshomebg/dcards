import { Nfc, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { getCurrentUser } from '@/modules/auth';
import { env } from '@/modules/core';
import { cartCount } from '@/modules/shop';

import { readCart } from './cart/store';

// Броят в header-а идва от cookie → Redis; страниците и без това са свежи.
export const dynamic = 'force-dynamic';

/** Публичната обвивка на витрината: header с количка и вход, без панел. */
export default async function ShopLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [user, cart] = await Promise.all([getCurrentUser(), readCart()]);
  const count = cartCount(cart);

  const { APP_NAME } = env();
  const account =
    user === null
      ? { href: '/login', label: 'Вход' }
      : { href: '/app', label: 'Моят акаунт' };

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="sticky top-0 z-10 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link
            href="/"
            className="flex items-center gap-2 truncate font-semibold text-ink"
          >
            <Nfc
              aria-hidden
              size={22}
              strokeWidth={1.75}
              className="text-brand"
            />
            {APP_NAME}
          </Link>

          <nav className="flex shrink-0 items-center gap-5 text-sm">
            <Link href="/products" className="hover:text-brand">
              Карти
            </Link>
            <Link href={account.href} className="hover:text-brand">
              {account.label}
            </Link>
            <Link
              href="/cart"
              aria-label={`Количка, ${String(count)} бр.`}
              className="relative hover:text-brand"
            >
              <ShoppingBag aria-hidden size={22} strokeWidth={1.75} />
              {count > 0 && (
                <span className="absolute -top-1.5 -right-2 flex min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] leading-4 font-semibold text-brand-contrast">
                  {count}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </header>

      <div className="flex-1">{children}</div>

      <footer className="border-t border-border bg-surface">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-6 text-sm text-text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>{APP_NAME} — NFC визитки с дигитален профил</span>
          <nav className="flex gap-4">
            <Link href="/products" className="hover:text-brand">
              Карти
            </Link>
            <Link href="/login" className="hover:text-brand">
              Вход за клиенти
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
