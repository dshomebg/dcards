import { describe, expect, it } from 'vitest';

import { isReservedSlug, RESERVED_SLUGS, slugSchema } from './slug';

const ok = (slug: string) => slugSchema.safeParse(slug).success;

describe('slugSchema', () => {
  it('accepts lowercase letters, digits and inner dashes', () => {
    expect(ok('ivan-petrov')).toBe(true);
    expect(ok('abc')).toBe(true);
    expect(ok('a1-b2')).toBe(true);
    expect(ok('a'.repeat(30))).toBe(true);
  });

  it('rejects the boundaries: 2 and 31 characters', () => {
    expect(ok('ab')).toBe(false);
    expect(ok('a'.repeat(31))).toBe(false);
  });

  it('rejects leading/trailing dashes, spaces and upper case', () => {
    expect(ok('-abc')).toBe(false);
    expect(ok('abc-')).toBe(false);
    expect(ok('a b')).toBe(false);
    expect(ok('Ab')).toBe(false);
    expect(ok('Demo')).toBe(false);
    expect(ok('')).toBe(false);
  });

  it('reports a Bulgarian message', () => {
    const result = slugSchema.safeParse('Ab');
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('малки латински букви');
  });
});

describe('RESERVED_SLUGS', () => {
  it('holds the platform routes', () => {
    for (const slug of ['admin', 'api', 'app', 'c', 'login', 'dcards']) {
      expect(RESERVED_SLUGS.has(slug)).toBe(true);
      expect(isReservedSlug(slug)).toBe(true);
    }
    expect(isReservedSlug('ivan-petrov')).toBe(false);
  });
});
