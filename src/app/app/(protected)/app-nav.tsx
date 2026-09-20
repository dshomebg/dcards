'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

const ITEMS = [
  { href: '/app', label: 'Профили' },
  { href: '/app/cards', label: 'Карти' },
  { href: '/app/orders', label: 'Поръчки' },
  { href: '/app/analytics', label: 'Статистика' },
  { href: '/app/org', label: 'Организация' },
  { href: '/app/settings', label: 'Настройки' },
] as const;

// `/app` е активен само точно; `/app/profiles/*` остава под „Профили".
function isActive(pathname: string, href: string): boolean {
  if (href === '/app') {
    return pathname === '/app' || pathname.startsWith('/app/profiles');
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Хоризонтална лента, превърта се на тесен екран — без страничен панел. */
export function AppNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Основна навигация" className="border-b border-border">
      <ul className="flex gap-1 overflow-x-auto px-4">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="flex-none">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'block border-b-2 px-3 py-3 text-sm font-medium whitespace-nowrap transition-colors',
                  active
                    ? 'border-brand text-brand'
                    : 'border-transparent text-text-muted hover:text-text',
                )}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
