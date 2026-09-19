'use client';

/**
 * Подсказката до етикета на контрол (`ADM-20`). Нативен `popover`, не
 * позициониран `div`: областта със съдържание се превърта (`ADM-9`) и би
 * отрязала панел до долния ръб. `Esc` и щракването встрани идват наготово.
 */

import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useId, useRef } from 'react';

import { tooltipPosition } from './tooltip-position';

type Props = Readonly<{
  children: ReactNode;
  /** Достъпното име на бутона — какво поле обяснява. */
  label: string;
}>;

/**
 * ⚠ БЕЗ `popovertarget` на бутона: той прави бутона нативен invoker с действие
 * „превключи", което се изпълнява СЛЕД обработчика — тоест всяко щракване
 * затваря отвореното от посочването (`ADM-20`, ревю 2026-08-13).
 */
export function Tooltip({ children, label }: Props) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  /** Мери се СЛЕД отварянето: затворен панел е `display:none` и връща нули. */
  const position = useCallback(() => {
    const node = panel.current;
    const button = anchor.current;
    if (node === null || button === null) return;

    const rect = button.getBoundingClientRect();
    // Иконката е излязла от прозореца — панелът няма към какво да се върже.
    if (rect.bottom < 0 || rect.top > window.innerHeight) {
      node.hidePopover();
      return;
    }

    const place = tooltipPosition(rect, node.getBoundingClientRect(), {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    node.style.top = `${String(place.top)}px`;
    node.style.left = `${String(place.left)}px`;
  }, []);

  const show = useCallback(() => {
    const node = panel.current;
    // Браузър без `popover`: подсказката просто не се показва. Проверката е
    // преди `matches`, защото `:popover-open` там е НЕВАЛИДЕН селектор и хвърля.
    if (node === null || typeof node.showPopover !== 'function') return;
    // Втори `showPopover` върху отворен панел хвърля, а той се вика и от
    // посочване, и от фокус — при щракване с мишка двете идват едно след друго.
    if (node.matches(':popover-open')) return;

    node.showPopover();
    position();
  }, [position]);

  const hide = useCallback(() => {
    const node = panel.current;
    if (node?.matches(':popover-open') === true) node.hidePopover();
  }, []);

  // Горният слой не се превърта с иконката. ⚠ Панелът се ПРЕМЕСТВА, а не се
  // затваря: `Tab` до иконката сам предизвиква превъртане и затварянето би
  // изяждало точно клавиатурния вход.
  useEffect(() => {
    const node = panel.current;
    if (node === null) return undefined;

    const onToggle = (event: Event) => {
      const open = (event as ToggleEvent).newState === 'open';
      // `true`: превъртането на вътрешен скролер не изплува до прозореца.
      if (open) window.addEventListener('scroll', position, true);
      else window.removeEventListener('scroll', position, true);
    };

    node.addEventListener('toggle', onToggle);
    return () => {
      node.removeEventListener('toggle', onToggle);
      window.removeEventListener('scroll', position, true);
    };
  }, [position]);

  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-label={label}
        className="text-text-muted hover:text-brand shrink-0 transition-colors"
        // ⚠ Само мишка: на екран за докосване браузърът пуска `pointerenter`
        // непосредствено преди `click`, тоест панелът би мигнал и изчезнал.
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') show();
        }}
        // Отворен от клавиатура панел НЕ се затваря от минаваща мишка: фокусът
        // остава на бутона и нито `pointerenter`, нито `focus` ще се повторят.
        onPointerLeave={(event) => {
          const focused = document.activeElement === event.currentTarget;
          if (event.pointerType === 'mouse' && !focused) hide();
        }}
        onClick={show}
        onFocus={show}
        onBlur={hide}
      >
        <Info aria-hidden size={14} />
      </button>

      {/* `aria-hidden`: текстът стига до екранния четец през скрития абзац на
          етикета, който остава в `aria-describedby` на самия контрол. Иначе
          същото изречение би се прочело два пъти. */}
      <div
        ref={panel}
        id={id}
        popover="auto"
        aria-hidden
        // `inset-auto` бие UA стила на `[popover]` (`inset: 0`): без него
        // `right`/`bottom` остават нула и ширината зависи от това докъде е
        // паднал левият ръб, вместо от съдържанието.
        className="bg-info text-brand-contrast fixed inset-auto m-0 max-w-72 rounded-(--radius-card) px-3 py-2 text-xs shadow-card"
      >
        {children}
      </div>
    </>
  );
}
