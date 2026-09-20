// Темата на профила: валидация на jsonb-а и гейтването на Pro полетата
// (`primaryColor`, `logoBackground`) по плана — едно място за четене и запис.

import { z } from 'zod';

import { can, type PlanFields } from './plan';
import type { ProfileTheme } from './profile.schema';

export const DEFAULT_THEME: ProfileTheme = {
  preset: 'light',
  primaryColor: null,
  logoBackground: false,
  layout: 'default',
};

// `logoBackground` дойде след първите редове (PLT-7) — стар json минава без миграция.
export const profileThemeSchema = z.object({
  preset: z.enum(['light', 'dark', 'sand']),
  primaryColor: z
    .string()
    .regex(/^#[0-9a-f]{6}$/i)
    .transform((value) => value.toLowerCase())
    .nullable(),
  logoBackground: z.boolean().default(false),
  layout: z.literal('default'),
});

/** Лош ред в базата (през studio) не бива да дава 500 на публичната страница. */
export function safeTheme(raw: unknown): ProfileTheme {
  const parsed = profileThemeSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_THEME;
}

/** За четене: Free и изтекъл Pro виждат само preset-а; редът не се пипа. */
export function themeForPlan(
  org: PlanFields,
  theme: ProfileTheme,
): ProfileTheme {
  if (can(org, 'customTheme')) return theme;
  return { ...theme, primaryColor: null, logoBackground: false };
}

/**
 * За запис: без Pro входът за Pro полетата се игнорира и остава каквото е в
 * реда — отказ би блокирал всеки запис на име при изтекъл Pro (PLT-7 § 7а).
 */
export function mergeThemeForPlan(
  org: PlanFields,
  input: ProfileTheme,
  current: ProfileTheme,
): ProfileTheme {
  if (can(org, 'customTheme')) return input;
  return {
    ...input,
    primaryColor: current.primaryColor,
    logoBackground: current.logoBackground,
  };
}
