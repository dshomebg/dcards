import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Организации' };

export default function Page() {
  return <ComingSoon title="Организации" />;
}
