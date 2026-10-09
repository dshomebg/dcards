'use server';

import { revalidatePath } from 'next/cache';

import { logUnexpected } from '@/lib/log-unexpected';
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
