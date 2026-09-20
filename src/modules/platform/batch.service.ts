// Партиди: създаване (транзакция + повторен опит при сблъсък на id), списък,
// детайл, „записани" и редовете за CSV.

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

// Относително, не през barrel-а на `core`: той отваря пул и Redis при импорт, а
// `platform` се внася и от клиентски форми (`slugSchema`) в dom тестове без среда.
import { isUniqueViolation } from '../core/db/errors';
import {
  countCardsByBatchAndStatus,
  findBatchById,
  findBatches,
  findCardCodesByBatch,
  findCardsByBatch,
  insertBatch,
  insertCards,
  markBlankCardsWritten,
} from './card.repository';
import type { CardBatch, CardStatus } from './card.schema';
import { CardError } from './card.service';
import type { CardCsvRow } from './card-csv';
import { type CardGenerator, defaultCardGenerator } from './card-id';

/** Три пъти: при 32⁸ стойности втори сблъсък подред означава счупен генератор. */
const MAX_ATTEMPTS = 3;

/** Толкова тегления на код на карта — отвъд това уникалният индекс е втора линия. */
const CODE_DRAWS = 10;

export const createBatchInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  quantity: z.number().int().min(1).max(1000),
  createdBy: z.uuid(),
});

export type CreateBatchInput = z.input<typeof createBatchInputSchema>;

interface GeneratedCard {
  readonly id: string;
  readonly activationCode: string;
}

/** Кодовете се дедупват в паметта (уникални в партидата); id-тата ги пази PK-то. */
function generateCards(
  quantity: number,
  generate: CardGenerator,
): GeneratedCard[] {
  const codes = new Set<string>();
  const result: GeneratedCard[] = [];
  for (let i = 0; i < quantity; i += 1) {
    let code = generate.activationCode();
    for (let draw = 1; draw < CODE_DRAWS && codes.has(code); draw += 1) {
      code = generate.activationCode();
    }
    codes.add(code);
    result.push({ id: generate.cardId(), activationCode: code });
  }
  return result;
}

/**
 * Партида + всичките ѝ карти в една транзакция. Нарушен уникален индекс я
 * връща цяла и наборът се генерира наново — до `MAX_ATTEMPTS`, после
 * `id_collision`. `createdBy` идва от сесията на админа, никога от формата.
 */
export async function createBatch(
  executor: DbExecutor,
  input: CreateBatchInput,
  generate: CardGenerator = defaultCardGenerator,
): Promise<CardBatch> {
  const parsed = createBatchInputSchema.safeParse(input);
  if (!parsed.success) throw new CardError('input_invalid');
  const { name, quantity, createdBy } = parsed.data;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const generated = generateCards(quantity, generate);
    try {
      return await executor.transaction(async (tx) => {
        const batch = await insertBatch(tx, { name, quantity, createdBy });
        await insertCards(
          tx,
          generated.map((card) => ({ ...card, batchId: batch.id })),
        );
        return batch;
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new CardError('id_collision');
}

export interface BatchSummary {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  /** Карти със статус ≠ `blank` — минали през писача на чипове. */
  readonly written: number;
  /** Точно `written` — свободни за присвояване към поръчка. */
  readonly available: number;
  readonly active: number;
  readonly createdAt: Date;
}

export async function listBatches(
  executor: DbExecutor,
): Promise<BatchSummary[]> {
  const [batches, counts] = await Promise.all([
    findBatches(executor),
    countCardsByBatchAndStatus(executor),
  ]);
  const empty = () => ({ written: 0, available: 0, active: 0 });
  const byBatch = new Map<string, ReturnType<typeof empty>>();
  for (const row of counts) {
    const acc = byBatch.get(row.batchId) ?? empty();
    if (row.status !== 'blank') acc.written += row.total;
    if (row.status === 'written') acc.available += row.total;
    if (row.status === 'active') acc.active += row.total;
    byBatch.set(row.batchId, acc);
  }
  return batches.map((batch) => ({
    id: batch.id,
    name: batch.name,
    quantity: batch.quantity,
    createdAt: batch.createdAt,
    ...(byBatch.get(batch.id) ?? empty()),
  }));
}

export interface BatchCardDto {
  readonly id: string;
  readonly activationCode: string;
  readonly status: CardStatus;
  readonly orgName: string | null;
  readonly profileName: string | null;
}

export interface BatchDetail {
  readonly id: string;
  readonly name: string;
  readonly quantity: number;
  readonly createdAt: Date;
  readonly cards: readonly BatchCardDto[];
}

/** `null` за непозната партида. Картите са ≤ 1000 — без прелистване. */
export async function getBatch(
  executor: DbExecutor,
  batchId: string,
): Promise<BatchDetail | null> {
  const batch = await findBatchById(executor, batchId);
  if (batch === null) return null;
  const rows = await findCardsByBatch(executor, batchId);
  return {
    id: batch.id,
    name: batch.name,
    quantity: batch.quantity,
    createdAt: batch.createdAt,
    cards: rows.map((row) => ({
      id: row.id,
      activationCode: row.activationCode,
      status: row.status,
      orgName: row.orgName,
      profileName:
        row.profileFirstName === null
          ? null
          : `${row.profileFirstName} ${row.profileLastName ?? ''}`.trim(),
    })),
  };
}

/** Връща колко карти са сменени; повторно → 0, без грешка. */
export function markBatchWritten(
  executor: DbExecutor,
  batchId: string,
): Promise<number> {
  return markBlankCardsWritten(executor, batchId);
}

/** `null` за непозната партида — handler-ът отговаря 404. */
export async function getBatchCsvRows(
  executor: DbExecutor,
  batchId: string,
): Promise<CardCsvRow[] | null> {
  const batch = await findBatchById(executor, batchId);
  if (batch === null) return null;
  return findCardCodesByBatch(executor, batchId);
}
