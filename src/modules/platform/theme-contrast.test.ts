import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  accentInk,
  contrastRatio,
  DARK_INK_HEX,
  LIGHT_INK_HEX,
  relativeLuminance,
} from './theme-contrast';

const tokens = readFileSync(
  join(process.cwd(), 'src/theme/tokens.css'),
  'utf8',
);
const token = (name: string) =>
  new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, 'i').exec(tokens)?.[1];

describe('theme-contrast', () => {
  it('uses the same inks as the design tokens', () => {
    expect(token('color-bg')?.toLowerCase()).toBe(LIGHT_INK_HEX);
    expect(token('color-ink')?.toLowerCase()).toBe(DARK_INK_HEX);
  });

  it('computes WCAG luminance and ratio for the reference pairs', () => {
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1, 5);
    expect(relativeLuminance('#000000')).toBe(0);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('picks light ink on dark accents and dark ink on light ones', () => {
    expect(accentInk('#8b1e3f')).toBe('light');
    expect(accentInk('#000000')).toBe('light');
    expect(accentInk('#ffffff')).toBe('dark');
    expect(accentInk('#ffd500')).toBe('dark');
    // Малки/големи букви — една и съща стойност.
    expect(accentInk('#8B1E3F')).toBe('light');
  });
});
