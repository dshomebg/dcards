// Кое мастило върху потребителски цвят — по WCAG контраст, на сървъра, без JS
// на публичната страница.

import type { ProfileTheme } from './profile.schema';

// Стойностите на `--color-bg` и `--color-ink` от `src/theme/tokens.css`: CSS
// променливите не се четат при рендер, а контрастът се смята тук. Тестът
// пада, ако двете места се разминат.
export const LIGHT_INK_HEX = '#f4f6f5';
export const DARK_INK_HEX = '#2f4a54';

export type AccentInk = 'light' | 'dark';

function channel(hex: string, offset: number): number {
  const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
  return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
}

/** Относителна яркост по WCAG 2.x за `#rrggbb`. */
export function relativeLuminance(hex: string): number {
  return (
    0.2126 * channel(hex, 1) +
    0.7152 * channel(hex, 3) +
    0.0722 * channel(hex, 5)
  );
}

export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

// Фонът на всяка тема (`--profile-bg` в `profile-theme.css`), за да се мери Pro
// цветът и срещу него. Тестът пази стойностите в синхрон с `tokens.css`.
export const PRESET_BG_HEX: Readonly<Record<ProfileTheme['preset'], string>> = {
  light: LIGHT_INK_HEX,
  dark: DARK_INK_HEX,
  sand: '#d9cfc0',
  petrol: '#4e6e7a',
};

/** Чете ли се Pro цветът като текст направо върху фона на темата (AA, 4.5:1). */
export function accentReadableOn(
  preset: ProfileTheme['preset'],
  accentHex: string,
): boolean {
  return contrastRatio(accentHex, PRESET_BG_HEX[preset]) >= 4.5;
}

/** Мастилото с по-високия контраст върху `accentHex` (`#rrggbb`). */
export function accentInk(accentHex: string): AccentInk {
  const light = contrastRatio(accentHex, LIGHT_INK_HEX);
  const dark = contrastRatio(accentHex, DARK_INK_HEX);
  return light >= dark ? 'light' : 'dark';
}
