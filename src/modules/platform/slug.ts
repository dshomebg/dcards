// Адресът на профила: `/{slug}`. Главни букви се отхвърлят, не се нормализират —
// чипът носи точния URL и „Demo" не бива мълчаливо да стане „demo".

import { z } from 'zod';

/** Малки латински букви, цифри и тире; 3–30 знака; без тире в краищата. */
export const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;

export const slugSchema = z
  .string()
  .regex(
    SLUG_PATTERN,
    'Адресът може да съдържа само малки латински букви, цифри и тире (3–30 знака).',
  );

// Статичните сегменти на Next имат предимство пред `[slug]`, така че сблъсъкът
// не чупи маршрута — но клиент не бива да заеме адрес, който утре става страница.
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  'admin',
  'app',
  'api',
  'c',
  'login',
  'register',
  'logout',
  'products',
  'cart',
  'checkout',
  'order',
  'orders',
  'account',
  'settings',
  'help',
  'support',
  'about',
  'contact',
  'terms',
  'privacy',
  'static',
  'assets',
  'public',
  'www',
  'mail',
  'dcards',
  'health',
  'vcard',
  'qr',
  'scan',
  'scans',
  'card',
  'cards',
  'pricing',
  'pro',
  'signup',
  'signin',
  'auth',
  'dashboard',
  'profile',
  'profiles',
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}
