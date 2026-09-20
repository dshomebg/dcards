import { eq } from 'drizzle-orm';
import { afterAll, describe, expect, it } from 'vitest';

import { db } from '@/modules/core';

import { users } from '../auth/user.schema';
import {
  createBatch,
  getBatch,
  getBatchCsvRows,
  listBatches,
  markBatchWritten,
} from './batch.service';
import { cardBatches, cards } from './card.schema';
import { CardError } from './card.service';
import { ACTIVATION_CODE_PATTERN, CARD_ID_PATTERN } from './card-id';
import { createPersonalOrganization } from './organization.repository';
import { profiles } from './profile.schema';
import { createProfile } from './profile.service';
import { deleteProfile } from './profile-edit.service';

afterAll(async () => {
  await db.$client.end({ timeout: 5 });
});

let counter = 0;

async function admin(): Promise<string> {
  counter += 1;
  const rows = await db
    .insert(users)
    .values({
      email: `admin${counter}@example.bg`,
      passwordHash: 'h',
      name: 'A',
      isAdmin: true,
    })
    .returning({ id: users.id });
  const id = rows[0]?.id;
  if (id === undefined) throw new Error('no user row');
  return id;
}

const cardsOf = (batchId: string) =>
  db.select().from(cards).where(eq(cards.batchId, batchId)).orderBy(cards.id);

const batchesNamed = (name: string) =>
  db.select().from(cardBatches).where(eq(cardBatches.name, name));

async function codeOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof CardError) return error.code;
    throw error;
  }
  throw new Error('expected a CardError');
}

/** Детерминистичен генератор: id-тата идват от списък, кодовете са поредни. */
function scripted(ids: readonly string[]) {
  let idIndex = 0;
  let code = 0;
  return {
    calls: () => idIndex,
    generator: {
      cardId: () => {
        const id = ids[idIndex % ids.length];
        idIndex += 1;
        if (id === undefined) throw new Error('script exhausted');
        return id;
      },
      activationCode: () => {
        code += 1;
        return String(code).padStart(6, '0');
      },
    },
  };
}

describe('createBatch', () => {
  it('creates exactly N blank cards with 8-char ids and 6-digit codes, unique in the batch', async () => {
    const createdBy = await admin();
    const batch = await createBatch(db, {
      name: 'Тест',
      quantity: 50,
      createdBy,
    });
    expect(batch).toMatchObject({ name: 'Тест', quantity: 50, createdBy });

    const rows = await cardsOf(batch.id);
    expect(rows).toHaveLength(50);
    for (const row of rows) {
      expect(row.id).toHaveLength(8);
      expect(row.id).toMatch(CARD_ID_PATTERN);
      expect(row.activationCode).toMatch(ACTIVATION_CODE_PATTERN);
      expect(row.status).toBe('blank');
      expect(row.orgId).toBeNull();
      expect(row.profileId).toBeNull();
    }
    expect(new Set(rows.map((row) => row.activationCode)).size).toBe(50);
  });

  it('refuses 0, 1001, a fraction and an empty name without writing anything', async () => {
    const createdBy = await admin();
    const run = (input: Record<string, unknown>) =>
      codeOf(
        createBatch(db, { name: 'Отказ', quantity: 10, createdBy, ...input }),
      );
    await expect(run({ quantity: 0 })).resolves.toBe('input_invalid');
    await expect(run({ quantity: 1001 })).resolves.toBe('input_invalid');
    await expect(run({ quantity: 2.5 })).resolves.toBe('input_invalid');
    await expect(run({ name: '   ' })).resolves.toBe('input_invalid');
    expect(await batchesNamed('Отказ')).toHaveLength(0);
  });

  it('retries with a fresh set after a colliding id and ends with unique ids', async () => {
    const createdBy = await admin();
    const first = scripted(['RETRYAA2', 'RETRYAA3']);
    await createBatch(
      db,
      { name: 'Първа', quantity: 2, createdBy },
      first.generator,
    );

    // Опит 1: `RETRYAA2` вече съществува → 23505; опит 2: свежи id-та.
    const second = scripted(['RETRYAA2', 'RETRYBB4', 'RETRYBB5', 'RETRYBB6']);
    const batch = await createBatch(
      db,
      { name: 'Втора', quantity: 2, createdBy },
      second.generator,
    );
    expect(second.calls()).toBe(4);
    expect((await cardsOf(batch.id)).map((row) => row.id)).toEqual([
      'RETRYBB5',
      'RETRYBB6',
    ]);
    expect(await batchesNamed('Втора')).toHaveLength(1);
  });

  it('gives up after three attempts with a constant generator and leaves nothing behind', async () => {
    const createdBy = await admin();
    const constant = scripted(['SAMESAME']);
    await expect(
      codeOf(
        createBatch(
          db,
          { name: 'Сблъсък', quantity: 3, createdBy },
          constant.generator,
        ),
      ),
    ).resolves.toBe('id_collision');
    expect(constant.calls()).toBe(9);
    expect(await batchesNamed('Сблъсък')).toHaveLength(0);
    expect(
      await db.select().from(cards).where(eq(cards.id, 'SAMESAME')),
    ).toHaveLength(0);
  });

  it('dedups activation codes in memory before the insert', async () => {
    const createdBy = await admin();
    const ids = ['DEDUPAA2', 'DEDUPAA3'];
    const codes = ['111111', '111111', '111111', '222222'];
    const generator = {
      cardId: () => ids.shift() ?? 'DEDUPXX9',
      activationCode: () => codes.shift() ?? '999999',
    };
    const batch = await createBatch(
      db,
      { name: 'Дедуп', quantity: 2, createdBy },
      generator,
    );
    expect((await cardsOf(batch.id)).map((row) => row.activationCode)).toEqual([
      '111111',
      '222222',
    ]);
  });
});

describe('listBatches / getBatch / getBatchCsvRows', () => {
  it('summarises written (≠ blank) and active per batch and returns the detail rows', async () => {
    const createdBy = await admin();
    const batch = await createBatch(db, {
      name: 'Списък',
      quantity: 4,
      createdBy,
    });
    const [a, b] = await cardsOf(batch.id);
    if (a === undefined || b === undefined) throw new Error('no cards');
    await db.update(cards).set({ status: 'active' }).where(eq(cards.id, a.id));
    await db.update(cards).set({ status: 'written' }).where(eq(cards.id, b.id));

    const summary = (await listBatches(db)).find((row) => row.id === batch.id);
    expect(summary).toMatchObject({
      name: 'Списък',
      quantity: 4,
      written: 2,
      active: 1,
    });

    const detail = await getBatch(db, batch.id);
    expect(detail?.cards).toHaveLength(4);
    expect(detail?.cards[0]).toEqual({
      id: a.id,
      activationCode: a.activationCode,
      status: 'active',
      orgName: null,
      profileName: null,
    });

    const csv = await getBatchCsvRows(db, batch.id);
    expect(csv).toHaveLength(4);
    expect(csv?.[0]).toEqual({ id: a.id, activationCode: a.activationCode });
  });

  it('returns null for an unknown batch', async () => {
    const missing = '00000000-0000-7000-8000-000000000000';
    expect(await getBatch(db, missing)).toBeNull();
    expect(await getBatchCsvRows(db, missing)).toBeNull();
  });
});

describe('markBatchWritten', () => {
  it('flips only blank cards, sets written_at, and is idempotent', async () => {
    const createdBy = await admin();
    const batch = await createBatch(db, {
      name: 'Запис',
      quantity: 5,
      createdBy,
    });
    const [active] = await cardsOf(batch.id);
    if (active === undefined) throw new Error('no cards');
    await db
      .update(cards)
      .set({ status: 'active' })
      .where(eq(cards.id, active.id));

    expect(await markBatchWritten(db, batch.id)).toBe(4);
    const rows = await cardsOf(batch.id);
    expect(rows.filter((row) => row.status === 'written')).toHaveLength(4);
    expect(rows.find((row) => row.id === active.id)?.status).toBe('active');
    for (const row of rows.filter((row) => row.status === 'written')) {
      expect(row.writtenAt).toBeInstanceOf(Date);
    }

    expect(await markBatchWritten(db, batch.id)).toBe(0);
  });
});

describe('foreign keys', () => {
  it('deleting a profile leaves the card in the org with profile_id = null', async () => {
    const createdBy = await admin();
    const org = await createPersonalOrganization(db, {
      ownerUserId: createdBy,
      name: 'A',
    });
    const profile = await createProfile(db, {
      orgId: org.id,
      slug: 'fk-card',
      firstName: 'И',
      lastName: 'П',
    });
    const batch = await createBatch(db, { name: 'FK', quantity: 1, createdBy });
    const [card] = await cardsOf(batch.id);
    if (card === undefined) throw new Error('no cards');
    await db
      .update(cards)
      .set({ orgId: org.id, profileId: profile.id, status: 'active' })
      .where(eq(cards.id, card.id));

    await deleteProfile(db, org.id, profile.id);
    expect(
      await db.select().from(profiles).where(eq(profiles.id, profile.id)),
    ).toHaveLength(0);
    const [after] = await cardsOf(batch.id);
    expect(after).toMatchObject({ orgId: org.id, profileId: null });
  });

  it('a batch with cards cannot be deleted', async () => {
    const createdBy = await admin();
    const batch = await createBatch(db, {
      name: 'Restrict',
      quantity: 1,
      createdBy,
    });
    await expect(
      db.delete(cardBatches).where(eq(cardBatches.id, batch.id)),
    ).rejects.toThrow();
    expect(await cardsOf(batch.id)).toHaveLength(1);
  });
});
