// Заявките на собственика на карта (`/c/{id}`, `/app/cards`). Всяка пише
// `org_id` в WHERE, не само в SET — чужда карта и липсваща са неразличими.

import {
  and,
  desc,
  eq,
  exists,
  inArray,
  isNull,
  ne,
  or,
  sql,
} from 'drizzle-orm';

import type { DbExecutor } from '@/modules/core';

import { cards, type CardStatus } from './card.schema';
import { profiles } from './profile.schema';

/** Профилът е в същата организация — иначе картата би сочила чужда страница. */
const profileInOrg = (executor: DbExecutor, profileId: string, orgId: string) =>
  exists(
    executor
      .select({ one: sql`1` })
      .from(profiles)
      .where(and(eq(profiles.id, profileId), eq(profiles.orgId, orgId))),
  );

export interface CardOrgProfileInput {
  readonly cardId: string;
  readonly orgId: string;
  readonly profileId: string;
}

/** `written|assigned` → `active`; `false` = guard-овете в WHERE не пуснаха. */
export async function activateCardRow(
  executor: DbExecutor,
  { cardId, orgId, profileId }: CardOrgProfileInput,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ status: 'active', orgId, profileId, activatedAt: new Date() })
    .where(
      and(
        eq(cards.id, cardId),
        inArray(cards.status, ['written', 'assigned']),
        or(isNull(cards.orgId), eq(cards.orgId, orgId)),
        profileInOrg(executor, profileId, orgId),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

/** `written|assigned` → `assigned` с org; повторно в същата org е без промяна. */
export async function claimCardRow(
  executor: DbExecutor,
  cardId: string,
  orgId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ status: 'assigned', orgId })
    .where(
      and(
        eq(cards.id, cardId),
        inArray(cards.status, ['written', 'assigned']),
        or(isNull(cards.orgId), eq(cards.orgId, orgId)),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

/** Свързва/сменя профила; `activated_at` остава от първото активиране. */
export async function assignCardProfileRow(
  executor: DbExecutor,
  { cardId, orgId, profileId }: CardOrgProfileInput,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({
      profileId,
      status: 'active',
      activatedAt: sql`coalesce(${cards.activatedAt}, now())`,
    })
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.orgId, orgId),
        inArray(cards.status, ['assigned', 'active']),
        profileInOrg(executor, profileId, orgId),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

/** `active` → `assigned` без профил — за разлика от админското „откачи". */
export async function unassignCardProfileRow(
  executor: DbExecutor,
  cardId: string,
  orgId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ profileId: null, status: 'assigned' })
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.orgId, orgId),
        eq(cards.status, 'active'),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

export async function disableCardRowByOrg(
  executor: DbExecutor,
  cardId: string,
  orgId: string,
): Promise<boolean> {
  const rows = await executor
    .update(cards)
    .set({ status: 'disabled' })
    .where(
      and(
        eq(cards.id, cardId),
        eq(cards.orgId, orgId),
        ne(cards.status, 'disabled'),
      ),
    )
    .returning({ id: cards.id });
  return rows.length > 0;
}

export interface OrgCardRow {
  readonly id: string;
  readonly status: CardStatus;
  readonly profileId: string | null;
  readonly profileFirstName: string | null;
  readonly profileLastName: string | null;
  readonly profileSlug: string | null;
  readonly activatedAt: Date | null;
}

export function findCardsByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<OrgCardRow[]> {
  return executor
    .select({
      id: cards.id,
      status: cards.status,
      profileId: cards.profileId,
      profileFirstName: profiles.firstName,
      profileLastName: profiles.lastName,
      profileSlug: profiles.slug,
      activatedAt: cards.activatedAt,
    })
    .from(cards)
    .leftJoin(profiles, eq(profiles.id, cards.profileId))
    .where(eq(cards.orgId, orgId))
    .orderBy(desc(cards.activatedAt), cards.id);
}
