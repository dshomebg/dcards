// Какво прави `/c/{id}` за даден ред от `cards` — чиста функция, без база.
// Изходът е дискриминиран по `kind`; страницата само го изпълнява.

import type { CardStatus } from './card.schema';

/** Редът от `findCardForRoute` — изрични полета, без код за активация (DAT-7). */
export interface CardRouteRow {
  readonly id: string;
  readonly status: CardStatus;
  readonly orgId: string | null;
  readonly profileId: string | null;
  readonly profileSlug: string | null;
}

export type CardRoute =
  | { readonly kind: 'not_found' }
  | { readonly kind: 'inactive' }
  | { readonly kind: 'unlinked' }
  | {
      readonly kind: 'redirect';
      readonly cardId: string;
      readonly profileId: string;
      readonly slug: string;
    }
  | {
      readonly kind: 'activate';
      readonly cardId: string;
      readonly orgId: string | null;
    };

/**
 * `blank` е 404 като липсваща карта — не е минала през писача. Скрит профил
 * пак е `redirect`: 404-ът идва от `/{slug}`, а сканирането се записва.
 */
export function resolveCard(row: CardRouteRow | null): CardRoute {
  if (row === null || row.status === 'blank') return { kind: 'not_found' };
  if (row.status === 'disabled') return { kind: 'inactive' };
  if (row.status === 'active') {
    if (row.profileId === null || row.profileSlug === null) {
      return { kind: 'unlinked' };
    }
    return {
      kind: 'redirect',
      cardId: row.id,
      profileId: row.profileId,
      slug: row.profileSlug,
    };
  }
  return { kind: 'activate', cardId: row.id, orgId: row.orgId };
}
