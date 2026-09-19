/**
 * Таблиците с иконки.
 *
 * Пълнотата им се пази от типовете (`satisfies` в `nav-icons.ts`) — тук се пази
 * онова, което типът не вижда: че две подсекции не носят един и същ знак и че
 * всеки ключ и адрес от картата има ред. Тестовата среда е без DOM, тоест
 * щракването и свиването се проверяват на ръка (`ADM-15` § 6).
 */

import { describe, expect, it } from 'vitest';

import { ITEM_ICONS, itemIcon, SECTION_ICONS } from './nav-icons';
import type { NavItem, NavSection } from './nav-tree';
import { NAV_SECTIONS } from './nav-tree';

// Разширени нарочно: тестът не се интересува от литералните типове — те са
// работа на `satisfies` в самата таблица.
const sections: readonly NavSection[] = NAV_SECTIONS;
const items: readonly NavItem[] = sections.flatMap((section) => section.items);
const sectionIcons: Readonly<Record<string, unknown>> = SECTION_ICONS;

describe('иконките на секциите', () => {
  it('покрива всеки ключ от картата', () => {
    for (const section of sections) {
      expect(sectionIcons[section.key], section.key).toBeDefined();
    }
  });

  it('няма ред за ключ извън картата', () => {
    const keys = sections.map((section) => section.key);

    expect(new Set(Object.keys(SECTION_ICONS))).toEqual(new Set(keys));
  });

  // Десет еднакви знака един под друг не са ориентир, а шарка: лентата е само
  // иконки и повторението прави две секции неразличими.
  it('дава РАЗЛИЧНА иконка на всяка секция', () => {
    const used = Object.values(SECTION_ICONS);

    expect(new Set(used).size).toBe(used.length);
  });
});

describe('иконките на подсекциите', () => {
  it('покрива всяка от седемте подсекции', () => {
    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(itemIcon(item.href), item.href).toBeDefined();
    }
  });

  it('няма ред за адрес извън картата', () => {
    const hrefs = items.map((item) => item.href);

    expect(new Set(Object.keys(ITEM_ICONS))).toEqual(new Set(hrefs));
  });

  // Ключът е АДРЕСЪТ, не надписът: „Карти" и „Настройки" са и секция, и ред.
  it('дава РАЗЛИЧНА иконка на всяка подсекция', () => {
    const used = Object.values(ITEM_ICONS);

    expect(new Set(used).size).toBe(used.length);
  });

  it('връща нищо за непознат адрес, вместо да гърми', () => {
    expect(itemIcon('/admin/nyama-takova')).toBeUndefined();
  });
});
