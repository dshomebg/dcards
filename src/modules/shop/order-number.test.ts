import { describe, expect, it } from 'vitest';

import {
  formatOrderNumber,
  ORDER_NUMBER_PATTERN,
  orderNumberSchema,
} from './order-number';

describe('formatOrderNumber', () => {
  it('pads the sequence to six digits', () => {
    expect(formatOrderNumber(2026, 1)).toBe('DC-2026-000001');
    expect(formatOrderNumber(2026, 123456)).toBe('DC-2026-123456');
  });

  it('keeps growing past six digits instead of truncating', () => {
    expect(formatOrderNumber(2027, 1234567)).toBe('DC-2027-1234567');
  });
});

describe('ORDER_NUMBER_PATTERN', () => {
  it('accepts the canonical form only', () => {
    expect(ORDER_NUMBER_PATTERN.test('DC-2026-000001')).toBe(true);
    for (const bad of [
      'abc',
      'dc-2026-000001',
      'DC-26-000001',
      'DC-2026-00001',
      'DC-2026-000001 ',
      "DC-2026-000001' OR 1=1",
    ]) {
      expect(ORDER_NUMBER_PATTERN.test(bad)).toBe(false);
    }
    expect(orderNumberSchema.safeParse('DC-2026-000001').success).toBe(true);
    expect(orderNumberSchema.safeParse('abc').success).toBe(false);
  });
});
