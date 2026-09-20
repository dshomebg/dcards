import { describe, expect, it } from 'vitest';

import { accentInk, contrastRatio, relativeLuminance } from './theme-contrast';

describe('theme-contrast', () => {
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
