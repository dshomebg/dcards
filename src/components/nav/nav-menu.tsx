'use client';

/**
 * Двойната навигация: тясна лента с иконки и колона на ИЗБРАНАТА секция
 * (`ADM-15`). Показва се на две места — като страничен панел на широк екран и
 * вътре в чекмеджето на тесен, — затова състоянието живее тук, не в обвивката.
 */

import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { cn } from '@/lib/cn';

import { NavColumn } from './nav-column';
import { NavRail } from './nav-rail';
import { activeHref, activeSection, NAV_SECTIONS } from './nav-tree';

/** Табло няма секция — колоната пак показва списък, вместо да стои празна. */
const FALLBACK_KEY = NAV_SECTIONS[0].key;

export function NavMenu({ className }: Readonly<{ className?: string }>) {
  const pathname = usePathname();
  const current = activeHref(pathname);

  /**
   * Показаната секция следва АДРЕСА; щракването важи само на същия екран.
   * ⚠ Не `useState(() => activeSection(pathname))`: инициализаторът тече веднъж,
   * а `layout.tsx` не се пресъздава при преход (капанът от ревюто на `ADM-7`).
   */
  const [manual, setManual] = useState<{ path: string; key: string | null }>({
    path: '',
    key: null,
  });
  const [collapsed, setCollapsed] = useState(false);

  // ⚠ Две различни неща (`ADM-27`): коя секция СВЕТИ в релсата и коя се
  // ПОКАЗВА в колоната. На таблото няма секция — светнеше първата и
  // два реда изглеждаха активни наведнъж.
  const highlighted =
    (manual.path === pathname ? manual.key : null) ?? activeSection(pathname);

  const selected = highlighted ?? FALLBACK_KEY;

  const section =
    NAV_SECTIONS.find((item) => item.key === selected) ?? NAV_SECTIONS[0];

  return (
    <div className={cn('flex bg-nav', className)}>
      <NavRail
        selected={highlighted}
        collapsed={collapsed}
        onSelect={(key) => {
          setManual({ path: pathname, key });
        }}
        onToggleCollapsed={() => {
          setCollapsed((value) => !value);
        }}
      />

      {/* Свитата колона просто я няма: полусвита колона с отрязани надписи е
          по-лоша от липсваща, а лентата пази имената на секциите (`ADM-22`). */}
      {!collapsed && (
        // Ключът е секцията: смяната ѝ пресъздава колоната, тоест превъртането
        // ѝ тръгва отгоре вместо от мястото на предишния списък.
        <NavColumn key={section.key} section={section} activePath={current} />
      )}
    </div>
  );
}
