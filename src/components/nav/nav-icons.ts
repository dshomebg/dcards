/**
 * Иконките на секциите и на подсекциите — по ключ и по адрес.
 * Стоят ТУК, а не в `nav-tree.ts`: картата е данни и наборът от иконки не бива
 * да е част от договора ѝ. Внасят се КОМПОНЕНТИ по иконка — `import * as icons`
 * слага 1500 SVG-та в пакета на всеки екран.
 */

import type { LucideIcon } from 'lucide-react';
import {
  Building,
  CreditCard,
  IdCard,
  Layers,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Settings2,
  ShoppingBag,
  Users,
  UsersRound,
  Wallet,
} from 'lucide-react';

import type { NavHref, NavSectionKey } from './nav-tree';

/** Табло — то не е секция и няма ключ в дървото. */
export const DashboardIcon: LucideIcon = LayoutDashboard;

/**
 * ⚠ `satisfies`, не анотация: анотацията би приела и непълна таблица, а тогава
 * нова секция излиза в лентата без иконка — тоест като празен квадрат.
 */
export const SECTION_ICONS = {
  orders: Receipt,
  cards: CreditCard,
  customers: Users,
  shop: ShoppingBag,
  settings: Settings,
} as const satisfies Record<NavSectionKey, LucideIcon>;

/**
 * Иконките на подсекциите. Ключът е АДРЕСЪТ, не надписът: „Карти" и „Настройки"
 * се срещат и като секция, и като ред, а адресът е самоличността на `activeHref`.
 */
export const ITEM_ICONS = {
  '/admin/orders': Wallet,
  // Партидата е купчина карти — слоеве; самата карта е една.
  '/admin/batches': Layers,
  '/admin/cards': IdCard,
  '/admin/users': UsersRound,
  '/admin/orgs': Building,
  '/admin/products': Package,
  '/admin/settings': Settings2,
} as const satisfies Record<NavHref, LucideIcon>;

/**
 * Иконката на подсекция. Приема `string`, защото разметката обхожда `NavSection`
 * с разширен тип — пълнотата се пази при ДЕКЛАРАЦИЯТА горе, не тук.
 */
export function itemIcon(href: string): LucideIcon | undefined {
  return (ITEM_ICONS as Readonly<Record<string, LucideIcon>>)[href];
}
