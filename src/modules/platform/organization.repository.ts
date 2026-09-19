// Достъп до `organizations` и `org_members` — единственото място в модула със SQL.

import { and, eq } from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import {
  type Organization,
  organizations,
  orgMembers,
} from './organization.schema';

export interface CreatePersonalOrganizationInput {
  readonly ownerUserId: string;
  readonly name: string;
}

/**
 * Лична организация плюс ред `owner` в `org_members` — в една транзакция.
 * Подаден изпълнител-транзакция я влага като savepoint, тоест остава атомарна
 * и с чуждата.
 */
export function createPersonalOrganization(
  executor: DbExecutor,
  input: CreatePersonalOrganizationInput,
): Promise<Organization> {
  return executor.transaction(async (tx) => {
    const rows = await tx
      .insert(organizations)
      .values({
        type: 'personal',
        name: input.name,
        ownerUserId: input.ownerUserId,
      })
      .returning();

    const created = rows[0];
    if (created === undefined) {
      throw new Error('insert organizations returned no row');
    }

    await tx
      .insert(orgMembers)
      .values({ orgId: created.id, userId: input.ownerUserId, role: 'owner' });

    return created;
  });
}

/** Личната организация на потребител — има най-много една (`seed-demo`). */
export async function findPersonalOrganizationByOwner(
  executor: DbExecutor,
  ownerUserId: string,
): Promise<Organization | null> {
  const rows = await executor
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.ownerUserId, ownerUserId),
        eq(organizations.type, 'personal'),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}
