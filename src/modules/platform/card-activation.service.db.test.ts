import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { CardError } from './card.service';
import {
  codeOf,
  rowOf,
  seedCard,
  seedOrg,
} from './card-activation.db-fixtures';
import { activateCard, claimCardByCode } from './card-activation.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

describe('activateCard', () => {
  it('activates a written card: active, org, profile, activated_at; returns the slug', async () => {
    const { userId, org, profile } = await seedOrg('act-ok');
    const card = await seedCard(userId);
    const result = await activateCard(db, {
      cardId: card.id.toLowerCase(),
      orgId: org.id,
      profileId: profile.id,
    });
    expect(result).toEqual({ slug: 'act-ok' });
    const row = await rowOf(card.id);
    expect(row).toMatchObject({
      status: 'active',
      orgId: org.id,
      profileId: profile.id,
    });
    expect(row?.activatedAt).toBeInstanceOf(Date);
  });

  it('refuses each status guard with its own code', async () => {
    const { userId, org, profile } = await seedOrg('act-guards');
    const input = (cardId: string) => ({
      cardId,
      orgId: org.id,
      profileId: profile.id,
    });
    const blank = await seedCard(userId, 'blank');
    const active = await seedCard(userId, 'active', org.id);
    const disabled = await seedCard(userId, 'disabled', org.id);

    expect(await codeOf(activateCard(db, input('NPNPNPNP')))).toBe(
      'card_unclaimable',
    );
    expect(await codeOf(activateCard(db, input(blank.id)))).toBe(
      'card_unclaimable',
    );
    expect(await codeOf(activateCard(db, input(active.id)))).toBe(
      'card_already_active',
    );
    expect(await codeOf(activateCard(db, input(disabled.id)))).toBe(
      'card_disabled',
    );
    expect(await codeOf(activateCard(db, { ...input('x'), orgId: 'no' }))).toBe(
      'input_invalid',
    );
  });

  it('refuses a card assigned to another org and a profile from another org', async () => {
    const mine = await seedOrg('act-mine');
    const other = await seedOrg('act-other');
    const foreign = await seedCard(mine.userId, 'assigned', other.org.id);
    expect(
      await codeOf(
        activateCard(db, {
          cardId: foreign.id,
          orgId: mine.org.id,
          profileId: mine.profile.id,
        }),
      ),
    ).toBe('card_foreign_org');

    const card = await seedCard(mine.userId);
    expect(
      await codeOf(
        activateCard(db, {
          cardId: card.id,
          orgId: mine.org.id,
          profileId: other.profile.id,
        }),
      ),
    ).toBe('profile_not_found');
    expect(await rowOf(card.id)).toMatchObject({
      status: 'written',
      orgId: null,
      profileId: null,
    });
  });

  it('lets exactly one of two concurrent activations through', async () => {
    const a = await seedOrg('act-race-a');
    const b = await seedOrg('act-race-b');
    const card = await seedCard(a.userId);
    const attempt = (org: typeof a) =>
      activateCard(db, {
        cardId: card.id,
        orgId: org.org.id,
        profileId: org.profile.id,
      }).then(
        () => 'ok',
        (error: unknown) =>
          error instanceof CardError ? error.code : 'unexpected',
      );

    const results = await Promise.all([attempt(a), attempt(b)]);
    expect(results.filter((r) => r === 'ok')).toHaveLength(1);
    expect(results).not.toContain('unexpected');
    expect((await rowOf(card.id))?.status).toBe('active');
  });
});

describe('claimCardByCode', () => {
  it('assigns a written card to the org; repeating in the same org is a no-op', async () => {
    const { userId, org } = await seedOrg('claim-ok');
    const card = await seedCard(userId);
    await claimCardByCode(db, {
      cardId: card.id,
      activationCode: card.code,
      orgId: org.id,
    });
    expect(await rowOf(card.id)).toMatchObject({
      status: 'assigned',
      orgId: org.id,
      profileId: null,
    });
    await claimCardByCode(db, {
      cardId: card.id,
      activationCode: card.code,
      orgId: org.id,
    });
    expect((await rowOf(card.id))?.status).toBe('assigned');
  });

  it('gives one code for a wrong code, an unknown card and a blank card', async () => {
    const { userId, org } = await seedOrg('claim-bad');
    const card = await seedCard(userId);
    const blank = await seedCard(userId, 'blank');
    const wrong = card.code === '000000' ? '000001' : '000000';

    for (const input of [
      { cardId: card.id, activationCode: wrong },
      { cardId: 'NPNPNPNP', activationCode: card.code },
      { cardId: blank.id, activationCode: blank.code },
    ]) {
      expect(
        await codeOf(claimCardByCode(db, { ...input, orgId: org.id })),
      ).toBe('card_unclaimable');
    }
    expect((await rowOf(card.id))?.status).toBe('written');
  });

  it('refuses another org, an active and a disabled card', async () => {
    const mine = await seedOrg('claim-mine');
    const other = await seedOrg('claim-other');
    const foreign = await seedCard(mine.userId, 'assigned', other.org.id);
    const active = await seedCard(mine.userId, 'active', mine.org.id);
    const disabled = await seedCard(mine.userId, 'disabled', mine.org.id);
    const claim = (card: { id: string; code: string }) =>
      codeOf(
        claimCardByCode(db, {
          cardId: card.id,
          activationCode: card.code,
          orgId: mine.org.id,
        }),
      );

    expect(await claim(foreign)).toBe('card_foreign_org');
    expect(await claim(active)).toBe('card_already_active');
    expect(await claim(disabled)).toBe('card_disabled');
  });
});
