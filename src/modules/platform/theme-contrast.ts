// Кое мастило върху потребителски цвят — по WCAG контраст, на сървъра, без JS
// на публичната страница.

// Стойностите на `--color-bg` и `--color-ink` от `src/theme/tokens.css`: CSS
// променливите не се четат при рендер, а контрастът се смята тук. Сменят ли се
// там, сменят се и тук.
const LIGHT_INK_HEX = '#f4f6f5';
const DARK_INK_HEX = '#2f4a54';

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

/** Мастилото с по-високия контраст върху `accentHex` (`#rrggbb`). */
export function accentInk(accentHex: string): AccentInk {
  const light = contrastRatio(accentHex, LIGHT_INK_HEX);
  const dark = contrastRatio(accentHex, DARK_INK_HEX);
  return light >= dark ? 'light' : 'dark';
}
