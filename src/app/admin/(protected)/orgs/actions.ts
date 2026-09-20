'use server';

import { DrizzleQueryError } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';

import { db, tooManyMessage } from '@/modules/core';
import { OrganizationError, updateOrganizationPlan } from '@/modules/platform';

import { requireAdmin } from '../current';
import { adminActionLimit } from '../rate-limit';
import { planFormSchema } from './schema';

export type PlanActionResult =
  { readonly ok: true } | { readonly ok: false; readonly message: string };

const failure = (message: string): PlanActionResult => ({
  ok: false,
  message,
});

function logUnexpected(where: string, error: unknown): void {
  // Drizzle носи параметрите в `message`, а pg `detail` — реда с имейла на
  // собственика. Логват се само код и constraint (DAT-6).
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause as
      { code?: string; constraint_name?: string } | undefined;
    console.error(`${where}: db error`, cause?.code, cause?.constraint_name);
    return;
  }
  console.error(`${where}:`, error instanceof Error ? error.name : 'error');
}

/** Zod → админ (извън `try`) → лимит → запис → revalidate. */
export async function setOrgPlanAction(
  orgId: unknown,
  plan: unknown,
  expiresOn: unknown,
): Promise<PlanActionResult> {
  const parsed = planFormSchema.safeParse({ orgId, plan, expiresOn });
  if (!parsed.success) {
    return failure(parsed.error.issues[0]?.message ?? 'Невалидни данни.');
  }
  const { data } = parsed;

  const admin = await requireAdmin();
  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) return failure(tooManyMessage(retryAfter));

  try {
    await updateOrganizationPlan(db, data.orgId, {
      plan: data.plan,
      expiresOn: data.expiresOn,
    });
  } catch (error) {
    if (error instanceof OrganizationError) return failure(error.message);
    logUnexpected('setOrgPlanAction', error);
    return failure('Промяната не беше записана — опитай пак след малко.');
  }

  revalidatePath('/admin/orgs');
  revalidatePath(`/admin/orgs/${data.orgId}`);
  return { ok: true };
}
