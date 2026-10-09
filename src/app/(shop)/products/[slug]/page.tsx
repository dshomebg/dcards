// Публична страница на продукт: `/products/{slug}`, без auth, винаги свежа.

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import { db, env } from '@/modules/core';
import {
  formatPrice,
  getActiveProductBySlug,
  productSlugSchema,
} from '@/modules/shop';

import { CardMockup } from '../../card-mockup';
import { MATERIAL_LABELS } from '../material-label';
import { AddToCartForm } from './add-to-cart-form';
import { Gallery } from './gallery';
import { ProductFacts } from './product-facts';

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

  const { APP_NAME, SHIPPING_COST_MINOR, STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-section px-4 py-10 md:grid-cols-2">
      <section className="flex flex-col gap-field">
        {product.images.length === 0 ? (
          <div className="flex aspect-square items-center justify-center rounded-(--radius-card) bg-surface-muted p-10">
            <CardMockup name={APP_NAME} />
          </div>
        ) : (
          <Gallery name={product.name} images={product.images} />
        )}
        {product.description !== null && (
          <p className="whitespace-pre-line">{product.description}</p>
        )}
      </section>

      <section className="flex flex-col gap-field md:[@media(min-height:56rem)]:sticky md:top-20">
        <header className="flex flex-col gap-hint">
          <span className="text-xs font-medium tracking-wide text-text-muted uppercase">
            {MATERIAL_LABELS[product.material]}
          </span>
          <h1 className="text-3xl font-semibold tracking-tight">
            {product.name}
          </h1>
          <p className="text-xl font-semibold text-brand">
            от {formatPrice(product.basePrice, format)}
          </p>
        </header>

        <div className="rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card)">
          {product.variants.length === 0 ? (
            <p className="text-text-muted">Изчерпано.</p>
          ) : (
            <AddToCartForm variants={product.variants} format={format} />
          )}
        </div>

        <ProductFacts shipping={formatPrice(SHIPPING_COST_MINOR, format)} />
      </section>
    </main>
  );
}
