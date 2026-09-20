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

  return (
    <div className="flex min-h-dvh flex-col bg-page">
      <header className="flex items-center justify-between gap-4 border-b border-border bg-surface px-4 py-3">
        <Link href="/" className="truncate font-semibold text-brand">
          {env().APP_NAME}
        </Link>

        <nav className="flex shrink-0 items-center gap-4 text-sm">
          <Link href="/products" className="hover:underline">
            Продукти
          </Link>
          <Link href="/cart" className="hover:underline">
            Количка ({count})
          </Link>
          {user === null ? (
            <Link href="/login" className="hover:underline">
              Вход
            </Link>
          ) : (
            <Link href="/app" className="hover:underline">
              Моят акаунт
            </Link>
          )}
        </nav>
      </header>

      <div className="flex-1">{children}</div>
    </div>
  );
}
