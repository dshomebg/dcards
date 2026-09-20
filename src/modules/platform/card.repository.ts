// Достъп до `card_batches` и `cards` — единственият SQL за двете таблици.

import { and, asc, count, desc, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import {
  type Card,
  type CardBatch,
  cardBatches,
  cards,
  type CardStatus,
  type NewCard,
  type NewCardBatch,
} from './card.schema';
import { organizations } from './organization.schema';
import { profiles } from './profile.schema';

export async function insertBatch(
  executor: DbExecutor,
  values: NewCardBatch,
): Promise<CardBatch> {
  const rows = await executor.insert(cardBatches).values(values).returning();
  const created = rows[0];
  if (created === undefined) {
    throw new Error('insert card_batches returned no row');
  }
  return created;
}

/** Една заявка за целия набор — до 1000 реда по 4 параметъра е далеч под тавана. */
export async function insertCards(
  executor: DbExecutor,
  values: readonly NewCard[],
): Promise<void> {
  if (values.length === 0) return;
  await executor.insert(cards).values([...values]);
}

/** Най-новите първо; `id` е uuidv7 — вторичен ред при еднакъв момент. */
export function findBatches(executor: DbExecutor): Promise<CardBatch[]> {
  return executor
    .select()
    .from(cardBatches)
    .orderBy(desc(cardBatches.createdAt), desc(cardBatches.id));
}

export async function findBatchById(
  executor: DbExecutor,
  batchId: string,
): Promise<CardBatch | null> {
  const rows = await executor
    .select()
    .from(cardBatches)
    .where(eq(cardBatches.id, batchId))
    .limit(1);
  return rows[0] ?? null;
}

export interface BatchStatusCount {
  readonly batchId: string;
  readonly status: CardStatus;
  readonly total: number;
}

export function countCardsByBatchAndStatus(
  executor: DbExecutor,
): Promise<BatchStatusCount[]> {
  return executor
    .select({ batchId: cards.batchId, status: cards.status, total: count() })
    .from(cards)
    .groupBy(cards.batchId, cards.status);
}

/** Ред за детайла на партида — изрични полета, без чужди колони (DAT-7). */
export interface BatchCardRow {
  readonly id: string;
  readonly activationCode: string;
  readonly status: CardStatus;
  readonly orgName: string | null;
  readonly profileFirstName: string | null;
  readonly profileLastName: string | null;
}

export function findCardsByBatch(
  executor: DbExecutor,
  batchId: string,
): Promise<BatchCardRow[]> {
  return executor
    .select({
      id: cards.id,
      activationCode: cards.activationCode,
      status: cards.status,
      orgName: organizations.name,
      profileFirstName: profiles.firstName,
      profileLastName: profiles.lastName,
    })
    .from(cards)
    .leftJoin(organizations, eq(organizations.id, cards.orgId))
    .leftJoin(profiles, eq(profiles.id, cards.profileId))
    .where(eq(cards.batchId, batchId))
    .orderBy(asc(cards.id));
}

export function findCardCodesByBatch(
  executor: DbExecutor,
  batchId: string,
): Promise<Pick<Card, 'id' | 'activationCode'>[]> {
  return executor
    .select({ id: cards.id, activationCode: cards.activationCode })
    .from(cards)
    .where(eq(cards.batchId, batchId))
    .orderBy(asc(cards.id));
}

/** Само `blank` → `written`; повторно извикване не пипа нищо и връща 0. */
export async function markBlankCardsWritten(
  executor: DbExecutor,
  batchId: string,
): Promise<number> {
  const rows = await executor
    .update(cards)
    .set({ status: 'written', writtenAt: new Date() })
    .where(and(eq(cards.batchId, batchId), eq(cards.status, 'blank')))
    .returning({ id: cards.id });
  return rows.length;
}

export interface AdminCardRow {
  readonly id: string;
  readonly batchId: string;
  readonly batchName: string;
  readonly activationCode: string;
  readonly status: CardStatus;
  readonly orgId: string | null;
  readonly orgName: string | null;
  readonly profileId: string | null;
  readonly profileFirstName: string | null;
  readonly profileLastName: string | null;
  readonly profileSlug: string | null;
  readonly writtenAt: Date | null;
  readonly activatedAt: Date | null;
}

export async function findCardWithRelations(
  executor: DbExecutor,
  cardId: string,
): Promise<AdminCardRow | null> {
  const rows = await executor
    .select({
      id: cards.id,
      batchId: cards.batchId,
      batchName: cardBatches.name,
      activationCode: cards.activationCode,
      status: cards.status,
      orgId: cards.orgId,
      orgName: organizations.name,
      profileId: cards.profileId,
      profileFirstName: profiles.firstName,
      profileLastName: profiles.lastName,
      profileSlug: profiles.slug,
      writtenAt: cards.writtenAt,
      activatedAt: cards.activatedAt,
    })
    .from(cards)
    .innerJoin(cardBatches, eq(cardBatches.id, cards.batchId))
    .leftJoin(organizations, eq(organizations.id, cards.orgId))
    .leftJoin(profiles, eq(profiles.id, cards.profileId))
    .where(eq(cards.id, cardId))
    .limit(1);
  return rows[0] ?? null;
}

/** `false` = няма такава карта. `orgId` остава — картата е неразпределена в org-а. */
export async function clearCardProfile(
  executor: DbExecutor,
  cardId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ profileId: null })
    .where(eq(cards.id, cardId))
    .returning({ id: cards.id });
  return rows.length > 0;
}

/** `false` = няма такава карта. Връзките остават — историята ѝ се вижда. */
export async function setCardDisabled(
  executor: DbExecutor,
  cardId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ status: 'disabled' })
    .where(eq(cards.id, cardId))
    .returning({ id: cards.id });
  return rows.length > 0;
}

/** Редът за `/c/{id}`: без код за активация — страницата е публична (DAT-7). */
export interface CardRouteRow {
  readonly id: string;
  readonly status: CardStatus;
  readonly orgId: string | null;
  readonly profileId: string | null;
  readonly profileSlug: string | null;
}

export async function findCardForRoute(
  executor: DbExecutor,
  cardId: string,
): Promise<CardRouteRow | null> {
  const rows = await executor
    .select({
      id: cards.id,
      status: cards.status,
      orgId: cards.orgId,
      profileId: cards.profileId,
      profileSlug: profiles.slug,
    })
    .from(cards)
    .leftJoin(profiles, eq(profiles.id, cards.profileId))
    .where(eq(cards.id, cardId))
    .limit(1);
  return rows[0] ?? null;
}

export interface LockedCardRow {
  readonly id: string;
  readonly status: CardStatus;
  readonly orgId: string | null;
  readonly activationCode: string;
}

/** Заключва реда на картата до края на транзакцията (`FOR UPDATE`). */
export async function lockCard(
  executor: DbExecutor,
  cardId: string,
): Promise<LockedCardRow | null> {
  const rows = await executor
    .select({
      id: cards.id,
      status: cards.status,
      orgId: cards.orgId,
      activationCode: cards.activationCode,
    })
    .from(cards)
    .where(eq(cards.id, cardId))
    .for('update');
  return rows[0] ?? null;
}
