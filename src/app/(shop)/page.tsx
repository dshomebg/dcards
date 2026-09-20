import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { db, env } from '@/modules/core';
import { listActiveProducts } from '@/modules/shop';

import { ProductCard } from './products/product-card';

export const dynamic = 'force-dynamic';

const FEATURED_LIMIT = 6;

const STEPS: readonly (readonly [string, string])[] = [
  ['Избери карта', 'Материал и вариант — цената е на страницата на продукта.'],
  [
    'Персонализирай',
    'Име и длъжност върху картата; лого — по имейл след поръчката.',
  ],
  [
    'Получи и активирай',
    'Картата идва с код; профилът се свързва от акаунта ти.',
  ],
];

export default async function HomePage() {
  const products = (await listActiveProducts(db)).slice(0, FEATURED_LIMIT);
  const { APP_NAME, STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-col gap-section px-4 py-10">
      <section className="flex flex-col items-start gap-field">
        <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="max-w-xl text-lg text-text-muted">
          NFC визитки с дигитален профил: едно докосване и контактът ти е в
          телефона на събеседника.
        </p>
        <Link href="/products" className={buttonStyles('primary')}>
          Разгледай продуктите
        </Link>
      </section>

      {products.length > 0 && (
        <section className="flex flex-col gap-block">
          <h2 className="text-xl font-semibold">Продукти</h2>
          <ul className="grid grid-cols-1 gap-field sm:grid-cols-2 md:grid-cols-3">
            {products.map((product) => (
              <ProductCard
                key={product.slug}
                product={product}
                format={format}
              />
            ))}
          </ul>
        </section>
      )}

      <section className="flex flex-col gap-block">
        <h2 className="text-xl font-semibold">Как работи</h2>
        <ol className="grid grid-cols-1 gap-field sm:grid-cols-3">
          {STEPS.map(([title, text], index) => (
            <li
              key={title}
              className="flex flex-col gap-hint rounded-(--radius-card) bg-surface-muted p-4"
            >
              <span className="text-sm font-semibold text-brand">
                {index + 1}. {title}
              </span>
              <span className="text-text-muted text-sm">{text}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
