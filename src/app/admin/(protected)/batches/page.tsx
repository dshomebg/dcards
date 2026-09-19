import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Партиди' };

export default function Page() {
  return <ComingSoon title="Партиди" />;
}
