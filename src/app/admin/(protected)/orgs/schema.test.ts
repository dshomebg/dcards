import { describe, expect, it, vi } from 'vitest';

// Barrel-ът на `platform` дърпа `core` (env, Redis) — тук трябва само чиста логика.
vi.mock('@/modules/core', () => ({}));

const { localDay } = await import('@/modules/platform');
const { planFormSchema } = await import('./schema');

const ORG_ID = '019969a0-0000-7000-8000-000000000001';
const today = localDay(new Date());

describe('planFormSchema', () => {
  it('keeps a future date for pro and nulls an empty one', () => {
    expect(
      planFormSchema.parse({ orgId: ORG_ID, plan: 'pro', expiresOn: today }),
    ).toEqual({ orgId: ORG_ID, plan: 'pro', expiresOn: today });
    expect(
      planFormSchema.parse({ orgId: ORG_ID, plan: 'pro', expiresOn: '' }),
    ).toEqual({ orgId: ORG_ID, plan: 'pro', expiresOn: null });
  });

  it('free drops the date whatever it is', () => {
    expect(
      planFormSchema.parse({
        orgId: ORG_ID,
        plan: 'free',
        expiresOn: '2000-01-01',
      }),
    ).toEqual({ orgId: ORG_ID, plan: 'free', expiresOn: null });
  });

  it('rejects a past date, a malformed date, a bad plan and a bad id', () => {
    const past = planFormSchema.safeParse({
      orgId: ORG_ID,
      plan: 'pro',
      expiresOn: '2000-01-01',
    });
    expect(past.success).toBe(false);
    expect(past.error?.issues[0]?.message).toBe(
      'Датата е минала — избери днес или по-късно.',
    );

    const malformed = planFormSchema.safeParse({
      orgId: ORG_ID,
      plan: 'pro',
      expiresOn: '31.12.2026',
    });
    expect(malformed.success).toBe(false);
    expect(malformed.error?.issues[0]?.message).toBe('Дата като 2026-12-31.');

    expect(
      planFormSchema.safeParse({ orgId: ORG_ID, plan: 'gold', expiresOn: '' })
        .success,
    ).toBe(false);
    expect(
      planFormSchema.safeParse({ orgId: 'abc', plan: 'pro', expiresOn: '' })
        .success,
    ).toBe(false);
  });
});
