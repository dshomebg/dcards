// Картата откъм собственика: активация през чипа, claim с код, свързване и
// откачане на профил, деактивация, списък. Всяко действие е с `orgId` от
// сесията и с `org_id` в WHERE (AUTH-2).

import { timingSafeEqual } from 'node:crypto';

import { z } from 'zod';

import type { DbExecutor } from '@/modules/core';

import { lockCard, type LockedCardRow } from './card.repository';
import type { CardStatus } from './card.schema';
import { CardError } from './card.service';
import {
  activateCardRow,
  assignCardProfileRow,
  claimCardRow,
  disableCardRowByOrg,
  findCardsByOrg,
  unassignCardProfileRow,
} from './card-activation.repository';
import { ACTIVATION_CODE_PATTERN, cardIdSchema } from './card-id';
import { findProfileByOrgAndId } from './profile.repository';

const cardOrgSchema = z.object({ cardId: cardIdSchema, orgId: z.uuid() });
const cardOrgProfileSchema = cardOrgSchema.extend({ profileId: z.uuid() });
const claimSchema = cardOrgSchema.extend({
  activationCode: z.string().regex(ACTIVATION_CODE_PATTERN),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new CardError('input_invalid');
  return parsed.data;
}

/** Общите guard-ове след `FOR UPDATE`; повтарят се и в WHERE на update-а. */
function assertClaimable(row: LockedCardRow | null, orgId: string): void {
  if (row === null || row.status === 'blank') {
    throw new CardError('card_unclaimable');
  }
  if (row.status === 'disabled') throw new CardError('card_disabled');
  if (row.orgId !== null && row.orgId !== orgId) {
    throw new CardError('card_foreign_org');
  }
  if (row.status === 'active') throw new CardError('card_already_active');
}

/** Двата низа са по 6 ASCII цифри (regex + CHECK) — дължините са равни. */
function codeMatches(expected: string, given: string): boolean {
  return timingSafeEqual(Buffer.from(expected), Buffer.from(given));
}

export interface ActivateCardInput {
  readonly cardId: string;
  readonly orgId: string;
  readonly profileId: string;
}

/** Активация от `/c/{id}`: `written|assigned` → `active`. Връща slug-а за redirect. */
export async function activateCard(
  executor: DbExecutor,
  input: ActivateCardInput,
): Promise<{ slug: string }> {
  const { cardId, orgId, profileId } = parse(cardOrgProfileSchema, input);
  return executor.transaction(async (tx) => {
    assertClaimable(await lockCard(tx, cardId), orgId);
    if (!(await activateCardRow(tx, { cardId, orgId, profileId }))) {
      throw new CardError('profile_not_found');
    }
    const profile = await findProfileByOrgAndId(tx, orgId, profileId);
    if (profile === null) throw new CardError('profile_not_found');
    return { slug: profile.slug };
  });
}

export interface ClaimCardInput {
  readonly cardId: string;
  readonly activationCode: string;
  readonly orgId: string;
}

/** „Добави карта" с код (§ 6.2): `written` → `assigned` в org-а на сесията. */
export async function claimCardByCode(
  executor: DbExecutor,
  input: ClaimCardInput,
): Promise<void> {
  const { cardId, activationCode, orgId } = parse(claimSchema, input);
  return executor.transaction(async (tx) => {
    const row = await lockCard(tx, cardId);
    if (row === null || row.status === 'blank') {
      throw new CardError('card_unclaimable');
    }
    if (!codeMatches(row.activationCode, activationCode)) {
      throw new CardError('card_unclaimable');
    }
    assertClaimable(row, orgId);
    if (!(await claimCardRow(tx, cardId, orgId))) {
      throw new CardError('card_unclaimable');
    }
  });
}

export interface CardOrgInput {
  readonly cardId: string;
  readonly orgId: string;
}

/** Свързва или сменя профила; чужда карта/профил → `card_not_found`. */
export async function assignCardProfile(
  executor: DbExecutor,
  input: ActivateCardInput,
): Promise<void> {
  const data = parse(cardOrgProfileSchema, input);
  if (!(await assignCardProfileRow(executor, data))) {
    throw new CardError('card_not_found');
  }
}

export async function unassignCardProfile(
  executor: DbExecutor,
  input: CardOrgInput,
): Promise<void> {
  const { cardId, orgId } = parse(cardOrgSchema, input);
  if (!(await unassignCardProfileRow(executor, cardId, orgId))) {
    throw new CardError('card_not_found');
  }
}

/** Терминално — връщане от `disabled` няма и за собственика. */
export async function disableCardByOrg(
  executor: DbExecutor,
  input: CardOrgInput,
): Promise<void> {
  const { cardId, orgId } = parse(cardOrgSchema, input);
  if (!(await disableCardRowByOrg(executor, cardId, orgId))) {
    throw new CardError('card_not_found');
  }
}

export interface OrgCardDto {
  readonly id: string;
  readonly status: CardStatus;
  readonly profile: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly activatedAt: Date | null;
}

/** Картите на организацията; членството проверява извикващият. */
export async function listCardsByOrg(
  executor: DbExecutor,
  orgId: string,
): Promise<OrgCardDto[]> {
  const rows = await findCardsByOrg(executor, orgId);
  return rows.map((row) => ({
    id: row.id,
    status: row.status,
    profile:
      row.profileId !== null && row.profileSlug !== null
        ? {
            id: row.profileId,
            name: `${row.profileFirstName ?? ''} ${row.profileLastName ?? ''}`.trim(),
            slug: row.profileSlug,
          }
        : null,
    activatedAt: row.activatedAt,
  }));
}
