'use client';

import type { LucideIcon } from 'lucide-react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { cn } from '@/lib/cn';

import { DashboardIcon, SECTION_ICONS } from './nav-icons';
import { NAV_SECTIONS } from './nav-tree';

type Props = Readonly<{
  /** `null` на таблото: там няма секция и нито една клетка не бива да свети. */
  selected: string | null;
  collapsed: boolean;
  onSelect: (key: string) => void;
  onToggleCollapsed: () => void;
}>;

/**
 * Избрано от собственика на око (`ADM-22`): първо двойно на предишните 20, после
 * свалено на 30. Доводът за 20 („иконка без текст до себе си") падна заедно с
 * надписа под нея.
 */
const RAIL_ICON = 30;

/**
 * Клетката е КОЛОНА: иконка отгоре, име отдолу, без твърда височина. Отстъпите
 * са стегнати като на съседната колона, а не по скалата на ФОРМИТЕ: с двойните
 * иконки дванайсетте клетки изкарваха „Настройки" под ръба (`ADM-22` § 3.6).
 */
const CELL =
  'flex w-full flex-col items-center gap-0.5 rounded-(--radius-control) ' +
  'px-1 py-1.5 transition-colors';

/**
 * Надписът е `text-hint` (11 px) — под това `design.md` § „Размер на текста" не
 * слиза. `break-words` е за „Администрация": тя е една дума и няма къде другаде
 * да се пренесе.
 */
const CELL_LABEL = 'text-hint text-center leading-tight break-words';

/** „Настройки" е закачена ДОЛУ, извън общия ред — както в образеца. */
const PINNED_KEY = 'settings';

type CellProps = Readonly<{
  label: string;
  /** Подава се ОТГОРЕ: там ключът още носи литералния си тип и няма нужда от
      привеждане, а таблицата остава пълна по построение. */
  icon: LucideIcon;
  selected: boolean;
  onSelect: () => void;
}>;

/**
 * ⚠ Бутонът НЕ е изключен дори при празна секция: браузърът потиска събитията
 * от мишката върху изключен бутон, тоест подсказката не би се показала, а
 * четецът чете само „бутон, недостъпен". Думата „предстои" е в колоната.
 */
function RailCell({ label, icon: Icon, selected, onSelect }: CellProps) {
  return (
    <li className="w-full">
      {/* ⚠ БЕЗ `aria-label` И БЕЗ `title`: името е видимо под иконката. Първият
          би го заменил, вторият става достъпно ОПИСАНИЕ и клетката се обявява
          два пъти — „Продукти, бутон, Продукти" (`ADM-22`, ревю 2026-08-13). */}
      <button
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
        className={cn(
          CELL,
          // Избраната е ПЛЪТНА: заливката се вижда отдалеч, преди надписът да е
          // прочетен. Цветът е даден точно от собственика.
          selected
            ? 'bg-rail-active text-rail-active-contrast'
            : 'text-text-muted hover:bg-nav-hover hover:text-text',
        )}
      >
        <Icon aria-hidden size={RAIL_ICON} />
        <span className={CELL_LABEL}>{label}</span>
      </button>
    </li>
  );
}

/** Лявата лента: по една клетка на секция — иконка и името ѝ под нея. */
export function NavRail({
  selected,
  collapsed,
  onSelect,
  onToggleCollapsed,
}: Props) {
  const pathname = usePathname();
  // Същият източник като на колоната: двата списъка не бива да се разминават —
  // ред в лентата без ред в колоната води в 404.
  const listed = NAV_SECTIONS.filter((section) => section.key !== PINNED_KEY);
  const pinned = NAV_SECTIONS.find((section) => section.key === PINNED_KEY);
  const Toggle = collapsed ? PanelLeftOpen : PanelLeftClose;

  return (
    // ⚠ Ширината носи НАЙ-ДЪЛГАТА дума („Администрация", 13 знака при 11 px).
    // Превърта се: с надписите клетките са двойно по-високи и на нисък прозорец
    // закачените долу иначе остават отрязани и недостижими.
    <div className="flex w-24 shrink-0 flex-col items-center gap-0.5 overflow-y-auto border-e border-border bg-nav px-1 py-3">
      <Link
        href="/admin"
        aria-current={pathname === '/admin' ? 'page' : undefined}
        className={cn(
          CELL,
          pathname === '/admin'
            ? 'bg-rail-active text-rail-active-contrast'
            : 'text-text-muted hover:bg-nav-hover hover:text-text',
        )}
      >
        <DashboardIcon aria-hidden size={RAIL_ICON} />
        <span className={CELL_LABEL}>Табло</span>
      </Link>

      <ul className="flex w-full flex-col items-center gap-0.5">
        {listed.map((section) => (
          <RailCell
            key={section.key}
            label={section.label}
            icon={SECTION_ICONS[section.key]}
            selected={selected === section.key}
            onSelect={() => {
              onSelect(section.key);
            }}
          />
        ))}
      </ul>

      {/* Закачените долу: превключвателят и „Настройки" — те не участват в реда
          по честота и мястото им е постоянно. */}
      <div className="mt-auto flex w-full flex-col items-center gap-0.5">
        {/* ⚠ Тук `title` ОСТАВА и това не противоречи на клетките горе: там той
            повтаряше името, а тук ДОБАВЯ — „Свий" сам не казва какво се свива.
            Видимото се съдържа в пълното, тоест гласовото управление го намира. */}
        <button
          type="button"
          title={collapsed ? 'Разгъни списъка' : 'Свий списъка'}
          aria-expanded={!collapsed}
          onClick={onToggleCollapsed}
          className={cn(
            CELL,
            'text-text-muted hover:bg-nav-hover hover:text-text',
          )}
        >
          <Toggle aria-hidden size={RAIL_ICON} />
          <span className={CELL_LABEL}>{collapsed ? 'Разгъни' : 'Свий'}</span>
        </button>

        {pinned !== undefined && (
          <ul className="w-full">
            <RailCell
              label={pinned.label}
              icon={SECTION_ICONS[pinned.key]}
              selected={selected === pinned.key}
              onSelect={() => {
                onSelect(pinned.key);
              }}
            />
          </ul>
        )}
      </div>
    </div>
  );
}
