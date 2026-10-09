import {
  ArrowRight,
  type LucideIcon,
  Nfc,
  Package,
  PenLine,
  QrCode,
  RefreshCw,
  SmartphoneNfc,
} from 'lucide-react';
import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { db, env } from '@/modules/core';
import { listActiveProducts } from '@/modules/shop';

import { CardMockup } from './card-mockup';
import { ProductCard } from './products/product-card';

export const dynamic = 'force-dynamic';

const FEATURED_LIMIT = 6;

type Item = readonly [LucideIcon, string, string];

// Само каквото продуктът наистина прави — без обещания, които кодът не държи.
const BENEFITS: readonly Item[] = [
  [
    Nfc,
    'Едно докосване',
    'Телефонът на събеседника отваря профила ти — без приложение.',
  ],
  [
    RefreshCw,
    'Винаги актуално',
    'Сменяш данните в профила си, а картата остава същата.',
  ],
  [QrCode, 'И с QR код', 'Профилът има QR код — за телефони без NFC.'],
];

const STEPS: readonly Item[] = [
  [Package, 'Избери карта', 'Материал и цвят — цената е на страницата.'],
  [PenLine, 'Персонализирай', 'Име, длъжност и лого върху картата.'],
  [
    SmartphoneNfc,
    'Активирай',
    'Докосни картата с телефона си и я свържи с профила си.',
  ],
];

function IconItem({ item, step }: Readonly<{ item: Item; step?: number }>) {
  const [Icon, title, text] = item;
  return (
    <li className="flex flex-col gap-hint rounded-(--radius-card) bg-surface p-5 shadow-(--shadow-card)">
      <span className="flex size-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
        <Icon aria-hidden size={20} strokeWidth={1.75} />
      </span>
      <span className="mt-2 font-semibold">
        {step === undefined ? title : `${String(step)}. ${title}`}
      </span>
      <span className="text-text-muted text-sm">{text}</span>
    </li>
  );
}

export default async function HomePage() {
  const products = (await listActiveProducts(db)).slice(0, FEATURED_LIMIT);
  const { APP_NAME, STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-section px-4 py-10 md:py-16">
      <section className="grid items-center gap-section md:grid-cols-2">
        <div className="flex flex-col items-start gap-field">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">
            Визитка, която се отваря с едно докосване
          </h1>
          <p className="max-w-xl text-lg text-text-muted">
            NFC карта с дигитален профил: контактът ти влиза в телефона на
            събеседника, без да го пише на ръка.
          </p>
          <Link href="/products" className={buttonStyles('primary')}>
            Разгледай картите
            <ArrowRight aria-hidden size={16} />
          </Link>
        </div>
        <div className="mx-auto w-full max-w-md md:rotate-3">
          <CardMockup name={APP_NAME} />
        </div>
      </section>

      <ul className="grid grid-cols-1 gap-field sm:grid-cols-3">
        {BENEFITS.map((item) => (
          <IconItem key={item[1]} item={item} />
        ))}
      </ul>

      {products.length > 0 && (
        <section className="flex flex-col gap-block">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-2xl font-semibold tracking-tight">Карти</h2>
            <Link
              href="/products"
              className="text-sm text-brand hover:underline"
            >
              Всички
            </Link>
          </div>
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
        </section>
      )}

      <section className="flex flex-col gap-block">
        <h2 className="text-2xl font-semibold tracking-tight">Как работи</h2>
        <ol className="grid grid-cols-1 gap-field sm:grid-cols-3">
          {STEPS.map((item, index) => (
            <IconItem key={item[1]} item={item} step={index + 1} />
          ))}
        </ol>
      </section>

      <section className="flex flex-col items-start gap-field rounded-(--radius-card) bg-ink p-8 text-bg md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-hint">
          <h2 className="text-2xl font-semibold tracking-tight">
            Готов за първата си карта?
          </h2>
          <p className="text-sand">Плащане при доставка.</p>
        </div>
        <Link
          href="/products"
          className="inline-flex items-center gap-2 rounded-(--radius-control) bg-bg px-4 py-2 font-medium text-ink hover:bg-sand"
        >
          Избери карта
          <ArrowRight aria-hidden size={16} />
        </Link>
      </section>
    </main>
  );
}
