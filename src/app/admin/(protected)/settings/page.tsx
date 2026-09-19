import type { Metadata } from 'next';

import { ComingSoon } from '../coming-soon';

export const metadata: Metadata = { title: 'Настройки' };

export default function Page() {
  return <ComingSoon title="Настройки" />;
}
