import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { createBatch } from './batch.service';
import { cards } from './card.schema';
import {
  CardError,
  detachCardProfile,
  disableCard,
  findCardForAdmin,
} from './card.service';
import { createPersonalOrganization } from './organization.repository';
import { createProfile } from './profile.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

let counter = 0;

/** Админ + организация + профил + карта, вече закачена за профила. */
async function seed(slug: string) {
  counter += 1;
  const rows = await db
    .insert(users)
    .values({
      email: `c${counter}@example.bg`,
      passwordHash: 'h',
      name: 'A',
      isAdmin: true,
    })
    .returning({ id: users.id });
  const userId = rows[0]?.id;
  if (userId === undefined) throw new Error('no user row');
  const org = await createPersonalOrganization(db, {
    ownerUserId: userId,
    name: 'Демо ООД',
  });
  const profile = await createProfile(db, {
    orgId: org.id,
    slug,
    firstName: 'Иван',
    lastName: 'Петров',
  });
  const batch = await createBatch(db, {
    name: `Партида ${slug}`,
    quantity: 1,
    createdBy: userId,
  });
  const card = (
    await db.select().from(cards).where(eq(cards.batchId, batch.id))
  )[0];
  if (card === undefined) throw new Error('no card');
  await db
    .update(cards)
    .set({ orgId: org.id, profileId: profile.id, status: 'active' })
    .where(eq(cards.id, card.id));
  return { org, profile, batch, cardId: card.id };
}

const rowOf = async (id: string) =>
  (await db.select().from(cards).where(eq(cards.id, id)))[0];

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CardError) return error.code;
    throw error;
  }
  throw new Error('expected a CardError');
}

describe('findCardForAdmin', () => {
  it('returns the card with batch, org and profile; null for an unknown id', async () => {
    const { org, profile, batch, cardId } = await seed('card-find');
    const dto = await findCardForAdmin(db, cardId);
    expect(dto).toEqual({
      id: cardId,
      batchId: batch.id,
      batchName: 'Партида card-find',
      activationCode: expect.stringMatching(/^\d{6}$/) as string,
      status: 'active',
      org: { id: org.id, name: 'Демо ООД' },
      profile: { id: profile.id, name: 'Иван Петров', slug: 'card-find' },
      writtenAt: null,
      activatedAt: null,
    });
    expect(await findCardForAdmin(db, 'NOPENOPE')).toBeNull();
  });
});

describe('detachCardProfile', () => {
  it('nulls profile_id and keeps org and status', async () => {
    const { org, cardId } = await seed('card-detach');
    await detachCardProfile(db, cardId);
    expect(await rowOf(cardId)).toMatchObject({
      profileId: null,
      orgId: org.id,
      status: 'active',
    });
    expect((await findCardForAdmin(db, cardId))?.profile).toBeNull();
  });

  it('card_not_found for an unknown id', async () => {
    await expect(codeOf(detachCardProfile(db, 'NOPENOPE'))).resolves.toBe(
      'card_not_found',
    );
  });
});

describe('disableCard', () => {
  it('sets disabled and keeps org and profile', async () => {
    const { org, profile, cardId } = await seed('card-disable');
    await disableCard(db, cardId);
    expect(await rowOf(cardId)).toMatchObject({
      status: 'disabled',
      orgId: org.id,
      profileId: profile.id,
    });
  });

  it('card_not_found for an unknown id', async () => {
    await expect(codeOf(disableCard(db, 'NOPENOPE'))).resolves.toBe(
      'card_not_found',
    );
  });
});
