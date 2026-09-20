'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db, tooManyMessage } from '@/modules/core';
import { CardError, createBatch, markBatchWritten } from '@/modules/platform';

import { requireAdmin } from '../current';
import { adminActionLimit } from '../rate-limit';
import { newBatchSchema } from './schema';

export interface ActionFailure {
  readonly ok: false;
  readonly message: string;
}

export type MarkWrittenResult =
  { readonly ok: true; readonly written: number } | ActionFailure;

const failure = (message: string): ActionFailure => ({ ok: false, message });

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите в `message`, а pg `detail` — целия ред (с кода за
  // активация). Логват се само код и constraint (DAT-6).
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  console.error(`${where}:`, error);
}

/**
 * „Нова партида": `createdBy` е САМО от сесията на админа. Не хвърля към
 * клиента; при успех пренасочва към детайла.
 */
export async function createBatchAction(
  input: unknown,
): Promise<ActionFailure> {
  const parsed = newBatchSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }

  // `redirect` при липсваща сесия хвърля — затова е извън `try`.
  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) return failure(tooManyMessage(retryAfter));

  let batchId: string;
  try {
    const batch = await createBatch(db, {
      ...parsed.data,
      createdBy: admin.id,
    });
    batchId = batch.id;
  } catch (error) {
    if (error instanceof CardError) return failure(error.message);
    logUnexpected('createBatchAction', error);
    return failure('Партидата не беше създадена — опитай пак след малко.');
  }

  revalidatePath('/admin/batches');
  redirect(`/admin/batches/${batchId}`);
}

/** Само `blank` → `written`; повторно натискане връща 0 без грешка. */
export async function markBatchWrittenAction(
  batchId: unknown,
): Promise<MarkWrittenResult> {
  const id = z.uuid().safeParse(batchId);
  if (!id.success) return failure('Партидата не съществува.');

  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) return failure(tooManyMessage(retryAfter));

  try {
    const written = await markBatchWritten(db, id.data);
    revalidatePath('/admin/batches');
    revalidatePath(`/admin/batches/${id.data}`);
    return { ok: true, written };
  } catch (error) {
    logUnexpected('markBatchWrittenAction', error);
    return failure('Картите не бяха маркирани — опитай пак след малко.');
  }
}
