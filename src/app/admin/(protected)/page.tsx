import type { Metadata } from 'next';

import { db } from '@/modules/core';
import { countAvailableCards, countOrganizations } from '@/modules/platform';
import { countActiveProducts, countOpenOrders } from '@/modules/shop';

import { requireAdmin } from './current';
import { DashboardTiles, type DashboardView } from './dashboard-tiles';

export const metadata: Metadata = { title: 'Табло' };

/** Броячите са „какво чака работа": отворени поръчки, свободни карти, org-ове, продукти. */
async function loadView(): Promise<DashboardView> {
  const [orders, cards, customers, shop] = await Promise.all([
    countOpenOrders(db),
    countAvailableCards(db),
    countOrganizations(db),
    countActiveProducts(db),
  ]);
  return {
    orders: { count: orders, href: '/admin/orders' },
    cards: { count: cards, href: '/admin/batches' },
    customers: { count: customers, href: '/admin/orgs' },
    shop: { count: shop, href: '/admin/products' },
    settings: { count: null, href: '/admin/settings' },
  };
}

export default async function DashboardPage() {
  await requireAdmin();
  const view = await loadView();
  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Табло</h1>
        <p className="text-text-muted mt-1 text-sm">
          Какво чака работа: отворени поръчки, свободни карти, клиенти,
          продукти.
        </p>
      </div>

      <DashboardTiles view={view} />
    </main>
  );
}
