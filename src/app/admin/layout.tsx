import type { Metadata } from 'next';
import type { ReactNode } from 'react';

// Само името, без `env()`: `metadata` се оценява при `next build`, където няма
// `.env` (Docker) и пълната схема би паднала на DATABASE_URL.
const name = `${process.env.APP_NAME ?? 'DCARDS'} Админ`;

export const metadata: Metadata = {
  title: { default: name, template: `%s | ${name}` },
  // Админът никога не се индексира.
  robots: { index: false, follow: false },
};

// Само метаданни. Пазачът е в `(protected)/layout.tsx`, за да не затваря входа.
export default function AdminLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return children;
}
