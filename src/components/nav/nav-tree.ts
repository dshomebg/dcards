/**
 * Картата на админа — секции и подсекции (`zadanie.md` § 7.3). Стои ТУК:
 * всеки спор „къде да иде новият екран" се решава срещу нея.
 * Подсекция без екран НЕ се изброява — връзка към 404 учи човека да не вярва
 * на менюто. Таблото е `/admin` и е извън картата.
 */

export interface NavItem {
  readonly label: string;
  readonly href: string;
}

export interface NavSection {
  readonly key: string;
  readonly label: string;
  readonly items: readonly NavItem[];
}

/**
 * ⚠ `as const satisfies`, НЕ анотация — анотацията разширява адресите до
 * `string` и пропусната иконка става празно място вместо грешка.
 */
export const NAV_SECTIONS = [
  {
    key: 'orders',
    label: 'Поръчки',
    items: [{ label: 'Поръчки', href: '/admin/orders' }],
  },
  {
    key: 'cards',
    label: 'Карти',
    items: [
      { label: 'Партиди', href: '/admin/batches' },
      { label: 'Карти', href: '/admin/cards' },
    ],
  },
  {
    key: 'customers',
    label: 'Клиенти',
    items: [
      { label: 'Потребители', href: '/admin/users' },
      { label: 'Организации', href: '/admin/orgs' },
    ],
  },
  {
    key: 'shop',
    label: 'Магазин',
    items: [{ label: 'Продукти', href: '/admin/products' }],
  },
  {
    key: 'settings',
    label: 'Настройки',
    items: [{ label: 'Настройки', href: '/admin/settings' }],
  },
] as const satisfies readonly NavSection[];

/** Ключът на секция — обединение от литералите, не `string`. */
export type NavSectionKey = (typeof NAV_SECTIONS)[number]['key'];

/**
 * Адресите на ВСИЧКИ подсекции. Оттук се типизира таблицата с иконки: нова
 * подсекция без иконка пада при компилация, а не се появява като празно място.
 */
export type NavHref = (typeof NAV_SECTIONS)[number]['items'][number]['href'];

/**
 * Коя подсекция е отворената. Сравнява се по префикс, за да светят и вътрешните
 * екрани (`/admin/cards/<id>`); при два подходящи печели по-дългият адрес.
 */
export function activeHref(
  pathname: string,
  sections: readonly NavSection[] = NAV_SECTIONS,
): string | null {
  const all = sections.flatMap((section) => section.items);

  const matches = all
    .filter(
      (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
    )
    .map((item) => item.href);

  return matches.toSorted((a, b) => b.length - a.length)[0] ?? null;
}

/** Секцията, в която е отвореният екран — нейният списък стои в колоната. */
export function activeSection(
  pathname: string,
  sections: readonly NavSection[] = NAV_SECTIONS,
): string | null {
  const href = activeHref(pathname, sections);
  if (href === null) return null;

  const found = sections.find((section) =>
    section.items.some((item) => item.href === href),
  );

  return found?.key ?? null;
}
