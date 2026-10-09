import type { Metadata } from 'next';

import { db, env } from '@/modules/core';
import { listActiveProducts } from '@/modules/shop';

import { ProductCard } from './product-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Карти' };

export default async function ProductsPage() {
  const products = await listActiveProducts(db);
  const { APP_NAME, STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-block px-4 py-10">
      <header className="flex flex-col gap-hint">
        <h1 className="text-3xl font-semibold tracking-tight">Карти</h1>
        <p className="text-text-muted">
          Всяка карта идва с дигитален профил, който редактираш сам.
        </p>
      </header>

      {products.length === 0 ? (
        <p className="text-text-muted">Скоро.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-field sm:grid-cols-2 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard
              key={product.slug}
              product={product}
              format={format}
              appName={APP_NAME}
            />
          ))}
        </ul>
      )}
    </main>
  );
}
