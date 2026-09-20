// Checkout: количката се преоценява от базата; без нито един достъпен ред →
// `/cart`; с недостъпен ред → бележка без форма (поръчката не пропуска редове).

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { loadCurrent } from '@/app/app/(protected)/current';
import { buttonStyles } from '@/components/ui/button';
import { db, env } from '@/modules/core';
import { priceCart } from '@/modules/shop';

import { readCart } from '../cart/store';
import { CheckoutForm } from './checkout-form';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Поръчка',
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const view = await priceCart(db, await readCart());
  if (!view.lines.some((line) => line.available)) redirect('/cart');

  const current = await loadCurrent();
  const { STORE_CURRENCY, STORE_LOCALE, SHIPPING_COST_MINOR } = env();
  const format = { currency: STORE_CURRENCY, locale: STORE_LOCALE };
  const blocked = view.lines.some((line) => !line.available);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-block px-4 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Поръчка</h1>

      {blocked ? (
        <div className="flex flex-col gap-field">
          <p role="alert" className="text-danger text-sm">
            Някои редове в количката вече не са налични. Премахни недостъпните
            редове, за да продължиш.
          </p>
          <Link
            href="/cart"
            className={buttonStyles('secondary', 'self-start')}
          >
            Към количката
          </Link>
        </div>
      ) : (
        <CheckoutForm
          view={view}
          format={format}
          shippingCost={SHIPPING_COST_MINOR}
          defaultValues={{
            name: current?.user.name ?? '',
            email: current?.user.email ?? '',
          }}
        />
      )}
    </main>
  );
}
