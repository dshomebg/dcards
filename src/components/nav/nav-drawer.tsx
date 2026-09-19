'use client';

import { Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';

import { NavMenu } from './nav-menu';

/**
 * Маркер, четим от JS: `wide:` го слага само над прага. Tailwind не изнася
 * `--breakpoint-wide` като CSS променлива, тоест `matchMedia` би било преписано
 * число — затова питаме самия CSS.
 */
const WIDE_MARKER = 'wide:[--wide:1]';

function isWide(element: HTMLElement): boolean {
  return getComputedStyle(element).getPropertyValue('--wide').trim() === '1';
}

/**
 * Навигацията при ТЕСЕН екран — бутон и изскачащ панел върху native `<dialog>`
 * + `showModal()`: задържане на фокуса, `Esc` и връщане на фокуса идват от
 * браузъра. Над прага бутонът се крие — там панелът е постоянен (`Sidebar`).
 */
export function NavDrawer() {
  const dialog = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (element === null) return;

    if (open && !element.open) element.showModal();
    else if (!open && element.open) element.close();
  }, [open]);

  // Преходът затваря панела: иначе поисканият екран се зарежда ЗАД него и
  // изглежда, че натискането не е стигнало доникъде.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Прекосяването на прага също го затваря: бутонът се крие с `wide:hidden`,
  // но отвореният диалог оставаше върху вече показания панел, без копче за
  // затваряне.
  useEffect(() => {
    const element = dialog.current;
    if (!open || element === null) return;

    const closeIfWide = () => {
      if (isWide(element)) setOpen(false);
    };

    closeIfWide();
    window.addEventListener('resize', closeIfWide);
    return () => {
      window.removeEventListener('resize', closeIfWide);
    };
  }, [open]);

  return (
    <>
      <Button
        variant="secondary"
        aria-expanded={open}
        onClick={() => {
          setOpen(true);
        }}
        className="shrink-0 wide:hidden"
      >
        <Menu aria-hidden size={16} />
        Меню
      </Button>

      <dialog
        ref={dialog}
        aria-label="Основна навигация"
        // `onClose` хваща и `Esc`, и програмното затваряне — така състоянието
        // тук не се разминава с това на браузъра.
        onClose={() => {
          setOpen(false);
        }}
        // Натискане ИЗВЪН панела: при модален `<dialog>` затъмненият фон е част
        // от самия елемент, тоест целта на събитието е самият диалог.
        // Натиснатото вътре сочи негово дете и не затваря нищо.
        onClick={(event) => {
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className={
          // Прилепен ВЛЯВО (`m-0 me-auto`): подразбиращото се `margin: auto`
          // увисваше панела в средата. Ширината е по СЪДЪРЖАНИЕТО, а
          // `overflow-x-auto` пази колоната от рязане при 320 px (`ADM-22`).
          'm-0 me-auto h-dvh max-h-dvh w-fit max-w-[92vw] overflow-x-auto p-0 ' +
          'border-e border-border bg-nav text-text backdrop:bg-overlay/50 ' +
          WIDE_MARKER
        }
      >
        <NavMenu className="h-full" />
      </dialog>
    </>
  );
}
