// Общи fixtures за db тестовете на картата откъм собственика.

import { eq } from 'drizzle-orm';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import { createBatch } from './batch.service';
import { cards, type CardStatus } from './card.schema';
import { CardError } from './card.service';
import { createPersonalOrganization } from './organization.repository';
import { createProfile } from './profile.service';

let counter = 0;

/** Потребител + лична org + профил. */
export async function seedOrg(slug: string) {
  counter += 1;
  const rows = await db
    .insert(users)
    .values({ email: `a${counter}@example.bg`, passwordHash: 'h', name: 'A' })
    .returning({ id: users.id });
  const userId = rows[0]?.id;
  if (userId === undefined) throw new Error('no user row');
  const org = await createPersonalOrganization(db, {
    ownerUserId: userId,
    name: `Org ${slug}`,
  });
  const profile = await createProfile(db, {
    orgId: org.id,
    slug,
    firstName: 'Иван',
    lastName: 'Петров',
  });
  return { userId, org, profile };
}

/** Една карта в даден статус; `written` е подразбирането — минала през писача. */
export async function seedCard(
  userId: string,
  status: CardStatus = 'written',
  orgId: string | null = null,
) {
  const batch = await createBatch(db, {
    name: 'Партида',
    quantity: 1,
    createdBy: userId,
  });
  const card = (
    await db.select().from(cards).where(eq(cards.batchId, batch.id))
  )[0];
  if (card === undefined) throw new Error('no card');
  await db.update(cards).set({ status, orgId }).where(eq(cards.id, card.id));
  return { id: card.id, code: card.activationCode };
}

export const rowOf = async (id: string) =>
  (await db.select().from(cards).where(eq(cards.id, id)))[0];

export async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CardError) return error.code;
    throw error;
  }
  throw new Error('expected a CardError');
}
