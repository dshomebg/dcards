/**
 * Дървото на навигацията. Разположението иска очи; КОЕ свети и коя секция е
 * разгъната е чиста логика и се проверява тук — грешката там е тиха: менюто
 * изгасва точно когато човекът е най-навътре в екран.
 */

import { describe, expect, it } from 'vitest';

import type { NavItem, NavSection } from './nav-tree';
import { activeHref, activeSection, NAV_SECTIONS } from './nav-tree';

const sectionsOf = (sections: readonly NavSection[]) => sections;

const itemsOf = (sections: readonly NavSection[]): NavItem[] =>
  sections.flatMap((section) => section.items);

describe('картата на админа', () => {
  // Редът на секциите е единственият ориентир в лентата и затова се заковава.
  it('е плосък списък от петте секции, в реда от заданието', () => {
    expect(NAV_SECTIONS.map((section) => section.key)).toEqual([
      'orders',
      'cards',
      'customers',
      'shop',
      'settings',
    ]);
  });

  it('няма две секции с един ключ', () => {
    const keys = sectionsOf(NAV_SECTIONS).map((section) => section.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('Карти носи „Партиди" преди „Карти"', () => {
    const cards = sectionsOf(NAV_SECTIONS).find(
      (section) => section.key === 'cards',
    );

    expect(cards?.items.map((item) => item.href)).toEqual([
      '/admin/batches',
      '/admin/cards',
    ]);
  });

  it('Клиенти носи потребителите и организациите', () => {
    const customers = sectionsOf(NAV_SECTIONS).find(
      (section) => section.key === 'customers',
    );

    expect(customers?.items.map((item) => item.href)).toEqual([
      '/admin/users',
      '/admin/orgs',
    ]);
  });

  it('има точно седем подсекции и всяка е под /admin', () => {
    const items = itemsOf(NAV_SECTIONS);

    expect(items).toHaveLength(7);
    for (const item of items) {
      expect(item.href.startsWith('/admin/')).toBe(true);
    }
  });

  it('няма две подсекции с един адрес', () => {
    const hrefs = itemsOf(NAV_SECTIONS).map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  // Таблото е извън картата — иначе на `/admin` би светила секция.
  it('таблото не е подсекция', () => {
    expect(itemsOf(NAV_SECTIONS).map((item) => item.href)).not.toContain(
      '/admin',
    );
  });
});

describe('activeHref', () => {
  it('намира точното съвпадение', () => {
    expect(activeHref('/admin/cards')).toBe('/admin/cards');
  });

  it('свети и на вътрешен екран', () => {
    expect(
      activeHref('/admin/cards/019fc000-0000-7000-8000-000000000000'),
    ).toBe('/admin/cards');
  });

  it('не свети на чужд адрес със същото начало', () => {
    expect(activeHref('/admin/cards-archive')).toBeNull();
  });

  it('при два подходящи печели по-дългият', () => {
    const sections = [
      {
        key: 'test',
        label: 'Тест',
        items: [
          { label: 'Медия', href: '/media' },
          { label: 'Образци', href: '/media/templates' },
        ],
      },
    ];

    expect(activeHref('/media/templates', sections)).toBe('/media/templates');
  });

  it('на таблото и на входа не свети нищо', () => {
    expect(activeHref('/admin')).toBeNull();
    expect(activeHref('/admin/login')).toBeNull();
  });
});

describe('activeSection', () => {
  it('разгъва секцията на отворения екран', () => {
    expect(activeSection('/admin/batches')).toBe('cards');
    expect(activeSection('/admin/orgs')).toBe('customers');
    expect(activeSection('/admin/products')).toBe('shop');
  });

  it('Настройките са своя секция', () => {
    expect(activeSection('/admin/settings')).toBe('settings');
    expect(activeHref('/admin/settings')).toBe('/admin/settings');
  });

  it('на таблото няма разгъната секция', () => {
    expect(activeSection('/admin')).toBeNull();
  });
});
