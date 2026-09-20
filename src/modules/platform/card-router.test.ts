import { describe, expect, it } from 'vitest';

import { type CardRouteRow, resolveCard } from './card-router';

const ORG = '019969a0-0000-7000-8000-00000000000a';
const PROFILE = '019969a0-0000-7000-8000-000000000001';

function row(overrides: Partial<CardRouteRow>): CardRouteRow {
  return {
    id: 'ABCD2345',
    status: 'written',
    orgId: null,
    profileId: null,
    profileSlug: null,
    ...overrides,
  };
}

describe('resolveCard', () => {
  it('not_found for a missing row and for a blank card', () => {
    expect(resolveCard(null)).toEqual({ kind: 'not_found' });
    expect(resolveCard(row({ status: 'blank' }))).toEqual({
      kind: 'not_found',
    });
  });

  it('inactive for a disabled card, even with a profile', () => {
    expect(
      resolveCard(
        row({ status: 'disabled', profileId: PROFILE, profileSlug: 'ivan' }),
      ),
    ).toEqual({ kind: 'inactive' });
  });

  it('redirect for an active card with a profile', () => {
    expect(
      resolveCard(
        row({
          status: 'active',
          orgId: ORG,
          profileId: PROFILE,
          profileSlug: 'ivan',
        }),
      ),
    ).toEqual({
      kind: 'redirect',
      cardId: 'ABCD2345',
      profileId: PROFILE,
      orgId: ORG,
      slug: 'ivan',
    });
  });

  it('unlinked for an active card without a profile', () => {
    expect(resolveCard(row({ status: 'active', orgId: ORG }))).toEqual({
      kind: 'unlinked',
    });
  });

  it('activate for written and assigned, carrying the org', () => {
    expect(resolveCard(row({ status: 'written' }))).toEqual({
      kind: 'activate',
      cardId: 'ABCD2345',
      orgId: null,
    });
    expect(resolveCard(row({ status: 'assigned', orgId: ORG }))).toEqual({
      kind: 'activate',
      cardId: 'ABCD2345',
      orgId: ORG,
    });
  });
});
