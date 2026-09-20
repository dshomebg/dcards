import { describe, expect, it } from 'vitest';

import { formatPrice, formatPriceInput, parsePriceInput } from './money';

describe('parsePriceInput', () => {
  it('accepts dot or comma with up to two decimals', () => {
    expect(parsePriceInput('12,50')).toBe(1250);
    expect(parsePriceInput('12.50')).toBe(1250);
    expect(parsePriceInput('12.5')).toBe(1250);
    expect(parsePriceInput('12')).toBe(1200);
    expect(parsePriceInput('0')).toBe(0);
    expect(parsePriceInput(' 19,90 ')).toBe(1990);
    expect(parsePriceInput('0.07')).toBe(7);
  });

  it('rejects garbage, three decimals, empty and too many digits', () => {
    for (const raw of ['1.999', 'abc', '', '.5', '12.', '1e3', '12345678']) {
      expect(parsePriceInput(raw)).toBeNull();
    }
  });

  it('allows a negative value only when asked', () => {
    expect(parsePriceInput('-2.00')).toBeNull();
    expect(parsePriceInput('-2.00', { allowNegative: true })).toBe(-200);
    expect(parsePriceInput('-0,5', { allowNegative: true })).toBe(-50);
  });
});

describe('formatPriceInput', () => {
  it('is the inverse of parsePriceInput', () => {
    expect(formatPriceInput(1250)).toBe('12.50');
    expect(formatPriceInput(0)).toBe('0.00');
    expect(formatPriceInput(7)).toBe('0.07');
    expect(formatPriceInput(-200)).toBe('-2.00');
    expect(parsePriceInput(formatPriceInput(199_999))).toBe(199_999);
  });
});

describe('formatPrice', () => {
  it('formats with the given currency and locale', () => {
    const text = formatPrice(1250, { currency: 'BGN', locale: 'bg-BG' });
    expect(text).toContain('12,50');
    expect(formatPrice(1250, { currency: 'EUR', locale: 'en-US' })).toBe(
      '€12.50',
    );
  });
});
