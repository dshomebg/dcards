// Количката: цените са от базата при всяко показване (MON-1/2). Формите за
// количество и „Премахни" са без JS — Server Action през `<form action>`.

import type { Metadata } from 'next';
import Link from 'next/link';

import { buttonStyles } from '@/components/ui/button';
import { logoUrl } from '@/lib/logo-url';
import { db, env } from '@/modules/core';
import {
  type CartViewLine,
  formatPrice,
  MAX_LINE_QUANTITY,
  priceCart,
  type PriceFormat,
} from '@/modules/shop';

import { removeCartLineAction, updateCartLineAction } from './actions';
import { readCart } from './store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Количка',
  robots: { index: false, follow: false },
};

type Props = Readonly<{ searchParams: Promise<{ error?: string | string[] }> }>;

const QUANTITIES = Array.from({ length: MAX_LINE_QUANTITY }, (_, i) => i + 1);

const REASONS = {
  out_of_stock: 'няма наличност',
  unavailable: 'не се предлага',
} as const;

const CONTROL_CLASS =
  'h-control rounded-(--radius-control) border border-border bg-surface px-3 text-sm';

function LineRow({
  line,
  format,
}: Readonly<{ line: CartViewLine; format: PriceFormat }>) {
  const { personalization } = line;
  return (
    <li className="flex flex-col gap-hint rounded-(--radius-card) border border-border bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-semibold">
          {line.productSlug === '' ? (
            line.productName
          ) : (
            <Link href={`/products/${line.productSlug}`}>
              {line.productName}
            </Link>
          )}
          {line.variantName !== '' && (
            <span className="text-text-muted font-normal">
              {' '}
              · {line.variantName}
            </span>
          )}
        </span>
        {line.available ? (
          <span className="text-sm">
            {line.quantity} × {formatPrice(line.unitPrice, format)} ={' '}
            <strong>{formatPrice(line.lineTotal, format)}</strong>
          </span>
        ) : (
          <span className="text-danger-ink text-sm">
            {REASONS[line.reason ?? 'unavailable']}
          </span>
        )}
      </div>

      <div className="flex items-center gap-field">
        {personalization.logoKey !== null && (
          <img
            src={logoUrl(personalization.logoKey)}
            alt="Лого"
            width={48}
            height={48}
            className="h-12 w-12 rounded-(--radius-control) border border-border object-contain"
          />
        )}
        <p className="text-text-muted text-sm">
          {personalization.name}
          {personalization.title !== null && `, ${personalization.title}`}
          {personalization.notes !== null && ` — ${personalization.notes}`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-field">
        {/* `onchange` без JS не праща — затова има бутон „Обнови". */}
        <form
          action={updateCartLineAction}
          className="flex items-center gap-hint"
        >
          <input type="hidden" name="lineId" value={line.id} />
          <label className="flex items-center gap-hint text-sm">
            Количество
            <select
              name="quantity"
              defaultValue={line.quantity}
              className={CONTROL_CLASS}
            >
              {QUANTITIES.map((quantity) => (
                <option key={quantity} value={quantity}>
                  {quantity}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className={buttonStyles('secondary')}>
            Обнови
          </button>
        </form>
        <form action={removeCartLineAction}>
          <input type="hidden" name="lineId" value={line.id} />
          <button
            type="submit"
            className={buttonStyles('ghost', 'text-danger')}
          >
            Премахни
          </button>
        </form>
      </div>
    </li>
  );
}

export default async function CartPage(props: Props) {
  const { error } = await props.searchParams;
  const cart = await readCart();
  const view = await priceCart(db, cart);
  const { STORE_CURRENCY, STORE_LOCALE } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-block px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Количка</h1>

      {error === 'limited' && (
        <p role="alert" className="text-danger text-sm">
          Твърде много опити. Опитай след малко.
        </p>
      )}

      {view.lines.length === 0 ? (
        <p className="text-text-muted">
          Количката е празна.{' '}
          <Link href="/products" className="text-brand underline">
            Към продуктите
          </Link>
        </p>
      ) : (
        <>
          <ul className="flex flex-col gap-field">
            {view.lines.map((line) => (
              <LineRow key={line.id} line={line} format={format} />
            ))}
          </ul>

          <section className="flex flex-col items-end gap-hint border-t border-border pt-4">
            <p className="text-lg">
              Общо: <strong>{formatPrice(view.subtotal, format)}</strong>
            </p>
            <p className="text-text-muted text-sm">
              Доставката се изчислява при поръчка.
            </p>
            <Link href="/checkout" className={buttonStyles('primary', 'mt-2')}>
              Към поръчката
            </Link>
          </section>
        </>
      )}
    </main>
  );
}
