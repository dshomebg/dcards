import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Потребители' };

export default function Page() {
  return <ComingSoon title="Потребители" />;
}
