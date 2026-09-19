'use client';

import Link from 'next/link';

import { cn } from '@/lib/cn';

import { itemIcon } from './nav-icons';
import type { NavSection } from './nav-tree';

type Props = Readonly<{
  section: NavSection;
  /** Кой адрес свети — идва от `activeHref`, не от щракането по лентата. */
  activePath: string | null;
}>;

const PENDING = 'Тази секция предстои.';

/** Втората колона: списъкът на ИЗБРАНАТА секция, винаги отворен, без шеврони. */
export function NavColumn({ section, activePath }: Props) {
  return (
    <nav
      aria-label={section.label}
      // Превъртането е ТУК, не на двойката: инак дългият списък отнася и лентата
      // нагоре. `ps-5` е по-голямо от `pe-3` по искане на собственика (`ADM-22`)
      // — между лентата и списъка да остане въздух, вместо двете да са долепени.
      className="flex w-56 shrink-0 flex-col gap-2 overflow-y-auto border-e border-border bg-nav py-4 pe-3 ps-5"
    >
      {/* ⚠ Главата ОСТАВА, макар лентата вече да носи имената (`ADM-22`): тук
          тя казва „списъкът отдолу е на тази секция", а не коя е избрана.
          Собственикът я иска именно тук (`ADM-15` § 7). */}
      <p className="text-text-muted px-2 text-xs font-medium tracking-wide uppercase">
        {section.label}
      </p>

      {section.items.length === 0 ? (
        <p className="text-text-muted px-2 text-sm">{PENDING}</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
          {section.items.map((item) => {
            const Icon = itemIcon(item.href);
            const active = activePath === item.href;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex items-center gap-2 rounded-(--radius-control)',
                    'px-3 py-1.5 text-sm transition-colors',
                    // Тонирана подложка, не бяла: панелът вече е бял и бялото
                    // върху бяло не се вижда. Тонът е на избраната иконка от
                    // лентата — двете сочат едно и също.
                    active
                      ? 'bg-rail-active-subtle font-medium text-rail-active-ink'
                      : 'text-text-muted hover:bg-nav-hover hover:text-text',
                  )}
                >
                  {Icon !== undefined && (
                    <Icon aria-hidden size={16} className="shrink-0" />
                  )}
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}
