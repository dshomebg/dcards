import type { Metadata } from 'next';

import { DashboardTiles, type DashboardView } from './dashboard-tiles';

export const metadata: Metadata = { title: 'Табло' };

// Броячите идват със следващите цикли; днес плочките са врати към секциите.
const VIEW: DashboardView = {
  orders: { count: null, href: '/admin/orders' },
  cards: { count: null, href: '/admin/cards' },
  customers: { count: null, href: '/admin/users' },
  shop: { count: null, href: '/admin/products' },
  settings: { count: null, href: '/admin/settings' },
};

export default function DashboardPage() {
  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="text-2xl font-semibold">Табло</h1>
        <p className="text-text-muted mt-1 text-sm">
          Тук ще е това, което чака работа. Секциите се отварят от панела вляво.
        </p>
      </div>

      <DashboardTiles view={VIEW} />
    </main>
  );
}
