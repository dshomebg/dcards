// Публична страница на продукт: `/products/{slug}`, без auth, винаги свежа.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { db, env } from '@/modules/core';
import { getActiveProductBySlug, productSlugSchema } from '@/modules/shop';

import { MATERIAL_LABELS } from '../material-label';
import { AddToCartForm } from './add-to-cart-form';

export const dynamic = 'force-dynamic';

// Изричен тип, не генерираният `PageProps` — виж `src/app/[slug]/page.tsx`.
type Props = Readonly<{ params: Promise<{ slug: string }> }>;

// Невалиден slug → 404 без заявка; `cache` обединява metadata и страницата.
const loadProduct = cache(async (slug: string) => {
  if (!productSlugSchema.safeParse(slug).success) return null;
  return getActiveProductBySlug(db, slug);
});

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { slug } = await props.params;
  const product = await loadProduct(slug);
  if (product === null) return {};
  return { title: product.name, description: product.description };
}

export default async function ProductPage(props: Props) {
  const { slug } = await props.params;
  const product = await loadProduct(slug);
  if (product === null) notFound();

  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-section px-4 py-10 md:grid-cols-2">
      <section className="flex flex-col gap-field">
        <header className="flex flex-col gap-hint">
          <h1 className="text-2xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="text-text-muted text-sm">
            {MATERIAL_LABELS[product.material]}
          </p>
        </header>
        {product.description !== null && (
          <p className="whitespace-pre-line">{product.description}</p>
        )}
      </section>

      <section className="rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card)">
        {product.variants.length === 0 ? (
          <p className="text-text-muted">Изчерпано.</p>
        ) : (
          <AddToCartForm variants={product.variants} format={format} />
        )}
      </section>
    </main>
  );
}
