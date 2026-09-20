'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { z } from 'zod';

import { db, env, sendMail } from '@/modules/core';
import {
  cancelInvitation,
  createInvitation,
  inviteMail,
  type IssuedInvitation,
  OrganizationError,
  removeMember,
  renameOrganization,
  resendInvitation,
} from '@/modules/platform';

import { type Current, requireOwner } from '../current';
import { inviteOrgLimit, userActionLimit } from '../rate-limit';
import { inviteMemberSchema, orgNameSchema } from './schema';

export type OrgActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

type OrgActionFailure = Extract<OrgActionResult, { ok: false }>;

const failure = (message: string): OrgActionFailure => ({
  ok: false,
  message,
});

const INVALID_ID = 'Записът не съществува.';
const FAILED = 'Промяната не беше записана — опитай пак след малко.';

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите (имейл, хеш) в `message` — само код и constraint (DAT-6).
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  console.error(`${where}:`, error instanceof Error ? error.name : 'error');
}

type Limit = (current: Current) => Promise<string | null>;
type Operation<T> = (current: Current) => Promise<T>;
type RunResult<T> = { readonly ok: true; readonly value: T } | OrgActionFailure;

/** Общият ред: owner (извън `try`) → лимити → сервиз → revalidate. */
async function runOwnerAction<T>(
  where: string,
  limit: Limit,
  operation: Operation<T>,
): Promise<RunResult<T>> {
  const current = await requireOwner();
  const limited =
    (await userActionLimit(current.user.id)) ?? (await limit(current));
  if (limited !== null) return failure(limited);

  let value: T;
  try {
    value = await operation(current);
  } catch (error) {
    if (error instanceof OrganizationError) return failure(error.message);
    logUnexpected(where, error);
    return failure(FAILED);
  }

  revalidatePath('/app/org');
  return { ok: true, value };
}

const done = (result: RunResult<unknown>): OrgActionResult =>
  result.ok ? { ok: true } : result;

const none: Limit = () => Promise.resolve(null);
const byOrg: Limit = ({ org }) => inviteOrgLimit(org.id);

/** Писмото след отговора; `sendMail` не хвърля. Суровият токен е само в линка. */
function mailInvitation(current: Current, issued: IssuedInvitation): void {
  after(() => {
    const { APP_NAME, APP_URL } = env();
    const mail = inviteMail({
      appName: APP_NAME,
      orgName: current.org.name,
      inviterName: current.user.name,
      inviteUrl: `${APP_URL}/invite?token=${issued.token}`,
    });
    return sendMail({ to: issued.email, ...mail }).then(() => undefined);
  });
}

export async function renameOrganizationAction(
  input: unknown,
): Promise<OrgActionResult> {
  const parsed = orgNameSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  return done(
    await runOwnerAction('renameOrganizationAction', none, async ({ org }) => {
      if (!(await renameOrganization(db, org.id, parsed.data.name))) {
        throw new OrganizationError('org_not_found');
      }
    }),
  );
}

/** Покана с роля `editor`; Free е запълнен от owner-а → `plan_limit_members`. */
export async function inviteMemberAction(
  input: unknown,
): Promise<OrgActionResult> {
  const parsed = inviteMemberSchema.safeParse(input);
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  return done(
    await runOwnerAction('inviteMemberAction', byOrg, async (current) => {
      const issued = await createInvitation(db, {
        org: current.org,
        inviter: { id: current.user.id, email: current.user.email },
        email: parsed.data.email,
      });
      mailInvitation(current, issued);
    }),
  );
}

/** „Изпрати пак": нов токен, старият линк умира; брои се към лимита по org. */
export async function resendInvitationAction(
  invitationId: unknown,
): Promise<OrgActionResult> {
  const id = z.uuid().safeParse(invitationId);
  if (!id.success) return failure(INVALID_ID);
  return done(
    await runOwnerAction('resendInvitationAction', byOrg, async (current) => {
      const issued = await resendInvitation(db, current.org.id, id.data);
      mailInvitation(current, issued);
    }),
  );
}

export async function cancelInvitationAction(
  invitationId: unknown,
): Promise<OrgActionResult> {
  const id = z.uuid().safeParse(invitationId);
  if (!id.success) return failure(INVALID_ID);
  return done(
    await runOwnerAction('cancelInvitationAction', none, ({ org }) =>
      cancelInvitation(db, org.id, id.data),
    ),
  );
}

/** Собственикът не се маха (нито сам себе си) — репозиторият го отказва по роля. */
export async function removeMemberAction(
  userId: unknown,
): Promise<OrgActionResult> {
  const id = z.uuid().safeParse(userId);
  if (!id.success) return failure(INVALID_ID);
  return done(
    await runOwnerAction('removeMemberAction', none, async ({ org }) => {
      if (!(await removeMember(db, org.id, id.data))) {
        throw new OrganizationError('member_not_found');
      }
    }),
  );
}
