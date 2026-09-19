/**
 * Рецептите за КАРТА и за РАЗДЕЛ — класове, не компоненти.
 *
 * Понятие „карта" в кода няма: седемнайсет места си преписваха класовете.
 * Компонент би искал `as`-проп, защото местата са `div`, `section`, `li`, `dl`
 * и обвивка на `table` — повече повърхност от една константа (`ADM-16` § 3.2).
 */

import { cn } from '@/lib/cn';

/**
 * Картата се отделя със СЯНКА, не с рамка: върху сивата страница рамката
 * очертава, а сянката повдига. `bg-surface` е част от рецептата — без него
 * съдържанието стои на сивото, не на бяло.
 */
const CARD = 'rounded-(--radius-card) bg-surface shadow-card';

export function cardStyles(className?: string): string {
  return cn(CARD, className);
}

// ⚠ Вложена карта днес НЯМА — проверени са и шестнайсетте, включително формата.
// Появи ли се, тя взима само `bg-surface`: две сенки дават мръсен ръб.

/**
 * Лентата с раздели. Губи `border-b`: линията под бутоните повтаря това, което
 * плътният активен раздел вече казва.
 */
export const TAB_LIST = 'flex gap-1 overflow-x-auto';

const TAB_BASE = [
  'rounded-(--radius-control) px-3 py-2 text-sm font-medium transition-colors',
  // Без свиване и без пренасяне — иначе дълъг надпис се разлива на два реда и
  // лентата пак става списък.
  'shrink-0 whitespace-nowrap',
].join(' ');

/**
 * Разделът като БУТОН. Активният е `rail-active`, НЕ `danger` — двата токена
 * днес са един низ, но значат различно. Обръща `ADM-16` § 3.5; обосновката е в
 * `decisions.md` § „Активният раздел е `brand`, а не червеното от снимката".
 */
export function tabStyles(
  state: Readonly<{ active: boolean; enabled: boolean }>,
  className?: string,
): string {
  return cn(
    TAB_BASE,
    state.active
      ? 'bg-rail-active text-rail-active-contrast'
      : 'text-text-muted',
    // ⚠ Осветяването е САМО за натискаемия и неактивния. `:hover` съвпада и
    // върху изключен бутон — потиска се доставката на събития, не оцветяването,
    // — тоест иначе разделът светва като натискаем и казва „забранено".
    state.enabled && !state.active ? 'hover:bg-surface-muted' : '',
    state.enabled ? '' : 'cursor-not-allowed opacity-50',
    className,
  );
}
