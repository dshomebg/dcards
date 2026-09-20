import type { Metadata } from 'next';

import { db, env } from '@/modules/core';
import { listActiveProducts } from '@/modules/shop';

import { ProductCard } from './product-card';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Продукти' };

export default async function ProductsPage() {
  const products = await listActiveProducts(db);
  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-block px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Продукти</h1>

      {products.length === 0 ? (
        <p className="text-text-muted">Скоро.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-field sm:grid-cols-2 md:grid-cols-3">
          {products.map((product) => (
            <ProductCard key={product.slug} product={product} format={format} />
          ))}
        </ul>
      )}
    </main>
  );
}
