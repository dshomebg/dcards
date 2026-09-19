import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Карти' };

export default function Page() {
  return <ComingSoon title="Карти" />;
}
