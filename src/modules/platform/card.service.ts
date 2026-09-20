// Карта за админа: търсене, откачане от профил, деактивация. Грешките са общи
// с партидите (`batch.service.ts`).

import type { DbExecutor } from '@/modules/core';

import {
  clearCardProfile,
  findCardWithRelations,
  setCardDisabled,
} from './card.repository';
import type { CardStatus } from './card.schema';

export type CardErrorCode =
  | 'input_invalid'
  | 'id_collision'
  | 'card_not_found'
  | 'card_unclaimable'
  | 'card_foreign_org'
  | 'card_already_active'
  | 'card_disabled'
  | 'profile_not_found';

const MESSAGES: Readonly<Record<CardErrorCode, string>> = {
  input_invalid: 'Има невалидни полета.',
  id_collision: 'Не се намери свободен набор от id — опитай пак.',
  card_not_found: 'Няма такава карта.',
  // Едно съобщение за грешен код, непозната и незаписана карта — без оракул.
  card_unclaimable: 'Картата или кодът не съвпадат.',
  card_foreign_org: 'Картата принадлежи на друга организация.',
  card_already_active: 'Картата вече е активирана.',
  card_disabled: 'Картата не е активна.',
  profile_not_found: 'Профилът не е в тази организация.',
};

/** `code` е за тестовете и екраните; `message` е за човека. */
export class CardError extends Error {
  constructor(readonly code: CardErrorCode) {
    super(MESSAGES[code]);
    this.name = 'CardError';
  }
}

export interface AdminCardDto {
  readonly id: string;
  readonly batchId: string;
  readonly batchName: string;
  readonly activationCode: string;
  readonly status: CardStatus;
  readonly org: { readonly id: string; readonly name: string } | null;
  readonly profile: {
    readonly id: string;
    readonly name: string;
    readonly slug: string;
  } | null;
  readonly writtenAt: Date | null;
  readonly activatedAt: Date | null;
}

/** `null` за непозната карта. Търсенето е точно — id-то минава `cardIdSchema` преди това. */
export async function findCardForAdmin(
  executor: DbExecutor,
  cardId: string,
): Promise<AdminCardDto | null> {
  const row = await findCardWithRelations(executor, cardId);
  if (row === null) return null;
  return {
    id: row.id,
    batchId: row.batchId,
    batchName: row.batchName,
    activationCode: row.activationCode,
    status: row.status,
    org:
      row.orgId !== null && row.orgName !== null
        ? { id: row.orgId, name: row.orgName }
        : null,
    profile:
      row.profileId !== null && row.profileSlug !== null
        ? {
            id: row.profileId,
            name: `${row.profileFirstName ?? ''} ${row.profileLastName ?? ''}`.trim(),
            slug: row.profileSlug,
          }
        : null,
    writtenAt: row.writtenAt,
    activatedAt: row.activatedAt,
  };
}

export async function detachCardProfile(
  executor: DbExecutor,
  cardId: string,
): Promise<void> {
  if (!(await clearCardProfile(executor, cardId))) {
    throw new CardError('card_not_found');
  }
}

/** Връщане от `disabled` няма — картата е физически извадена от обращение. */
export async function disableCard(
  executor: DbExecutor,
  cardId: string,
): Promise<void> {
  if (!(await setCardDisabled(executor, cardId))) {
    throw new CardError('card_not_found');
  }
}
