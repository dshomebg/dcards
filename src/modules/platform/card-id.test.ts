import { describe, expect, it } from 'vitest';

import {
  ACTIVATION_CODE_PATTERN,
  CARD_ID_ALPHABET,
  CARD_ID_LENGTH,
  CARD_ID_PATTERN,
  cardIdSchema,
  generateActivationCode,
  generateCardId,
} from './card-id';

describe('generateCardId', () => {
  it('makes 10 000 ids of 8 chars from the alphabet, without 0/O/1/I and without duplicates', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10_000; i += 1) {
      const id = generateCardId();
      expect(id).toHaveLength(CARD_ID_LENGTH);
      expect(id).toMatch(CARD_ID_PATTERN);
      expect(id).not.toMatch(/[0O1I]/);
      ids.add(id);
    }
    expect(ids.size).toBe(10_000);
  });

  it('uses all 32 symbols of the alphabet', () => {
    expect(CARD_ID_ALPHABET).toHaveLength(32);
    const seen = new Set<string>();
    for (let i = 0; i < 5_000; i += 1) {
      for (const char of generateCardId()) seen.add(char);
    }
    expect(seen.size).toBe(32);
    for (const char of seen) expect(CARD_ID_ALPHABET).toContain(char);
  });
});

describe('generateActivationCode', () => {
  it('is always six digits, padded with leading zeros', () => {
    for (let i = 0; i < 5_000; i += 1) {
      expect(generateActivationCode()).toMatch(ACTIVATION_CODE_PATTERN);
    }
  });
});

describe('cardIdSchema', () => {
  it('trims and upper-cases; 6–8 chars from the alphabet only', () => {
    expect(cardIdSchema.parse(' abcd2345 ')).toBe('ABCD2345');
    expect(cardIdSchema.parse('abcdef')).toBe('ABCDEF');
    expect(cardIdSchema.safeParse('O1234567').success).toBe(false);
    expect(cardIdSchema.safeParse('ABCDE').success).toBe(false);
    expect(cardIdSchema.safeParse('ABCDEFGHJ').success).toBe(false);
    expect(cardIdSchema.safeParse('ABCD-234').success).toBe(false);
    expect(cardIdSchema.safeParse('').success).toBe(false);
  });
});
