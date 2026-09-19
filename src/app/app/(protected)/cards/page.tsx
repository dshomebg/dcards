import type { Metadata } from 'next';

import { ComingSoon } from '@/components/coming-soon';

import { requireCurrent } from '../current';

export const metadata: Metadata = { title: 'Карти' };

export default async function Page() {
  await requireCurrent();
  return <ComingSoon title="Карти" />;
}
