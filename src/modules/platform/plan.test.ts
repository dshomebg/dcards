import { describe, expect, it } from 'vitest';

import { can, effectivePlan } from './plan';

const free = { plan: 'free', planExpiresAt: null } as const;
const pro = { plan: 'pro', planExpiresAt: null } as const;
const future = new Date(Date.now() + 86_400_000);
const past = new Date(Date.now() - 86_400_000);

describe('can — numeric limits', () => {
  it('Free: one profile, six links', () => {
    expect(can(free, 'profiles', 0)).toBe(true);
    expect(can(free, 'profiles', 1)).toBe(false);
    expect(can(free, 'links', 5)).toBe(true);
    expect(can(free, 'links', 6)).toBe(false);
    expect(can(free, 'members', 1)).toBe(false);
  });

  it('Pro: no limit', () => {
    expect(can(pro, 'profiles', 100)).toBe(true);
    expect(can(pro, 'links', 100)).toBe(true);
    expect(can({ plan: 'pro', planExpiresAt: future }, 'profiles', 5)).toBe(
      true,
    );
  });

  it('expired Pro counts as Free', () => {
    const expired = { plan: 'pro', planExpiresAt: past } as const;
    expect(effectivePlan(expired)).toBe('free');
    expect(can(expired, 'profiles', 1)).toBe(false);
    expect(can(expired, 'customTheme')).toBe(false);
  });

  it('defaults `used` to zero', () => {
    expect(can(free, 'profiles')).toBe(true);
  });
});

describe('can — boolean features', () => {
  it('returns the table value', () => {
    expect(can(free, 'customTheme')).toBe(false);
    expect(can(free, 'analytics')).toBe(false);
    expect(can(free, 'noBranding')).toBe(false);
    expect(can(pro, 'customTheme')).toBe(true);
    expect(can(pro, 'analytics')).toBe(true);
    expect(can(pro, 'noBranding')).toBe(true);
  });
});
