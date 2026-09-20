'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db, tooManyMessage } from '@/modules/core';
import {
  CardError,
  cardIdSchema,
  detachCardProfile,
  disableCard,
} from '@/modules/platform';

import { requireAdmin } from '../current';
import { adminActionLimit } from '../rate-limit';

export type CardActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const failure = (message: string): CardActionResult => ({
  ok: false,
  message,
});

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите в `message`, а pg `detail` — целия ред (с кода за
  // активация). Логват се само код и constraint (DAT-6).
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint);
    return;
  }
  console.error(`${where}:`, error);
}

type CardOperation = (executor: typeof db, cardId: string) => Promise<void>;

/** Общият ред: Zod → админ (извън `try`) → лимит → сервиз → revalidate. */
async function runCardAction(
  where: string,
  cardId: unknown,
  operation: CardOperation,
): Promise<CardActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return failure('Няма такава карта.');

  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) return failure(tooManyMessage(retryAfter));

  try {
    await operation(db, id.data);
  } catch (error) {
    if (error instanceof CardError) return failure(error.message);
    logUnexpected(where, error);
    return failure('Промяната не беше записана — опитай пак след малко.');
  }

  revalidatePath('/admin/cards');
  revalidatePath('/admin/batches');
  return { ok: true };
}

/** `profile_id = null`; картата остава в организацията като неразпределена. */
export async function detachCardAction(
  cardId: unknown,
): Promise<CardActionResult> {
  return await runCardAction('detachCardAction', cardId, detachCardProfile);
}

/** `status = 'disabled'`; org и профил остават. Връщане няма. */
export async function disableCardAction(
  cardId: unknown,
): Promise<CardActionResult> {
  return await runCardAction('disableCardAction', cardId, disableCard);
}
