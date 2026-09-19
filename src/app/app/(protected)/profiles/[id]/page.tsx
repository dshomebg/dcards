import type { Metadata } from 'next';

import { ComingSoon } from '@/components/coming-soon';

import { requireCurrent } from '../../current';

export const metadata: Metadata = { title: 'Профил' };

// Заглушка: редакторът идва с PLT-5; нищо не се чете от базата.
export default async function Page() {
  await requireCurrent();
  return <ComingSoon title="Профил" />;
}
