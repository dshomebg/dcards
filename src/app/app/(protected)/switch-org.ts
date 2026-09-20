'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';

import { db } from '@/modules/core';
import { findMembership } from '@/modules/platform';

import { requireCurrent } from './current';
import { setCurrentOrgId } from './current-org';
import { userActionLimit } from './rate-limit';

export interface SwitchOrgFailure {
  readonly ok: false;
  readonly message: string;
}

/** Смяна на текущата org: членство → cookie → `/app`. Чужда org → отказ. */
export async function switchOrgAction(
  orgId: unknown,
): Promise<SwitchOrgFailure> {
  const id = z.uuid().safeParse(orgId);
  if (!id.success) return { ok: false, message: 'Няма такава организация.' };

  const { user } = await requireCurrent();
  const limited = await userActionLimit(user.id);
  if (limited !== null) return { ok: false, message: limited };

  let member: boolean;
  try {
    member = (await findMembership(db, id.data, user.id)) !== null;
  } catch (error) {
    console.error(
      'switchOrgAction:',
      error instanceof Error ? error.name : 'error',
    );
    return { ok: false, message: 'Смяната не мина — опитай пак след малко.' };
  }
  if (!member) return { ok: false, message: 'Няма такава организация.' };

  await setCurrentOrgId(id.data);
  redirect('/app');
}
