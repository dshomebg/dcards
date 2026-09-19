import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Само името, без `env()`: `metadata` се оценява при `next build`, където няма
// `.env` (Docker) и пълната схема би паднала на DATABASE_URL.
const name = `${process.env.APP_NAME ?? 'DCARDS'}`;

export const metadata: Metadata = {
  title: { default: name, template: `%s | ${name}` },
  // Таблото на клиента не се индексира.
  robots: { index: false, follow: false },
};

// Само метаданни. Пазачът е в `(protected)/layout.tsx`.
export default function AppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
