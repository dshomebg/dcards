'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/modules/core';
import {
  activateCard,
  assignCardProfile,
  CardError,
  cardIdSchema,
  claimCardByCode,
  disableCardByOrg,
  isOrgMember,
  unassignCardProfile,
} from '@/modules/platform';

import { type Current, requireCurrent } from '../current';
import { claimLimit, userActionLimit } from '../rate-limit';
import { claimSchema } from './schema';

export type CardActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

export type CardActionFailure = Extract<CardActionResult, { ok: false }>;

const failure = (message: string): CardActionFailure => ({
  ok: false,
  message,
});

const NOT_FOUND = 'Няма такава карта.';
const NO_ACCESS = 'Нямаш достъп до тази организация.';
const FAILED = 'Промяната не беше записана — опитай пак след малко.';

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

type Limit = (current: Current) => Promise<string | null>;
type Operation<T> = (current: Current) => Promise<T>;
type RunResult<T> =
  { readonly ok: true; readonly value: T } | CardActionFailure;

/** Общият ред: сесия (извън `try`) → лимит → членство → сервиз → revalidate. */
async function runCardAction<T>(
  where: string,
  limit: Limit,
  operation: Operation<T>,
): Promise<RunResult<T>> {
  const current = await requireCurrent();
  const limited = await limit(current);
  if (limited !== null) return failure(limited);

  let value: T;
  try {
    if (!(await isOrgMember(db, current.org.id, current.user.id))) {
      return failure(NO_ACCESS);
    }
    value = await operation(current);
  } catch (error) {
    if (error instanceof CardError) return failure(error.message);
    logUnexpected(where, error);
    return failure(FAILED);
  }

  revalidatePath('/app/cards');
  return { ok: true, value };
}

const done = (result: RunResult<void>): CardActionResult =>
  result.ok ? { ok: true } : result;

const byUser: Limit = ({ user }) => userActionLimit(user.id);

/** „Добави карта": id + код → `assigned` в org-а на сесията. */
export async function claimCardAction(
  input: unknown,
): Promise<CardActionResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const { cardId, code } = parsed.data;
  return done(
    await runCardAction(
      'claimCardAction',
      ({ user }) => claimLimit(user.id, cardId),
      ({ org }) =>
        claimCardByCode(db, { cardId, activationCode: code, orgId: org.id }),
    ),
  );
}

/** „Свържи"/„Смени": профил от същата org; чужд id → „Няма такава карта". */
export async function assignCardProfileAction(
  cardId: unknown,
  profileId: unknown,
): Promise<CardActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  const profile = z.uuid().safeParse(profileId);
  if (!id.success || !profile.success) return failure(NOT_FOUND);
  return done(
    await runCardAction('assignCardProfileAction', byUser, ({ org }) =>
      assignCardProfile(db, {
        cardId: id.data,
        orgId: org.id,
        profileId: profile.data,
      }),
    ),
  );
}

/** „Откачи": `active` → `assigned`, `profile_id = null`. */
export async function unassignCardAction(
  cardId: unknown,
): Promise<CardActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return failure(NOT_FOUND);
  return done(
    await runCardAction('unassignCardAction', byUser, ({ org }) =>
      unassignCardProfile(db, { cardId: id.data, orgId: org.id }),
    ),
  );
}

/** „Деактивирай": терминално, само в собствената org. */
export async function disableCardAction(
  cardId: unknown,
): Promise<CardActionResult> {
  const id = cardIdSchema.safeParse(cardId);
  if (!id.success) return failure(NOT_FOUND);
  return done(
    await runCardAction('disableCardAction', byUser, ({ org }) =>
      disableCardByOrg(db, { cardId: id.data, orgId: org.id }),
    ),
  );
}

/** От `/c/{id}`: активира и пренасочва към профила; отказът се връща. */
export async function activateFromChipAction(
  cardId: unknown,
  profileId: unknown,
): Promise<CardActionFailure> {
  const id = cardIdSchema.safeParse(cardId);
  const profile = z.uuid().safeParse(profileId);
  if (!id.success || !profile.success) return failure(NOT_FOUND);

  const result = await runCardAction(
    'activateFromChipAction',
    byUser,
    ({ org }) =>
      activateCard(db, {
        cardId: id.data,
        orgId: org.id,
        profileId: profile.data,
      }),
  );
  if (!result.ok) return result;
  // `redirect` хвърля — стои извън `try`. През `/c/{id}`, не право към профила:
  // така първото отваряне е „чип", а не „линк" в статистиката.
  redirect(`/c/${id.data}`);
}
