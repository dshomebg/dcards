// Лимитите на Free и Pro (§ 8). Единственото място, което тълкува `plan` заедно
// с `planExpiresAt` (AUTH-3): изтекъл Pro е Free.

import type { Organization } from './organization.schema';

/** `null` = без лимит. */
interface PlanLimits {
  readonly profiles: number | null;
  readonly links: number | null;
  readonly customTheme: boolean;
  readonly analytics: boolean;
  readonly members: number | null;
  readonly noBranding: boolean;
}

export type Feature = keyof PlanLimits;

export const PLAN_LIMITS: Readonly<Record<Organization['plan'], PlanLimits>> = {
  free: {
    profiles: 1,
    links: 6,
    customTheme: false,
    analytics: false,
    members: 1,
    noBranding: false,
  },
  pro: {
    profiles: null,
    links: null,
    customTheme: true,
    analytics: true,
    members: null,
    noBranding: true,
  },
};

export type PlanFields = Pick<Organization, 'plan' | 'planExpiresAt'>;

export function effectivePlan(
  org: PlanFields,
  now = new Date(),
): Organization['plan'] {
  if (
    org.plan === 'pro' &&
    org.planExpiresAt !== null &&
    org.planExpiresAt <= now
  ) {
    return 'free';
  }
  return org.plan;
}

/** Числов лимит: може ли още едно при `used` вече заети. Булев: както е в таблицата. */
export function can(
  org: PlanFields,
  feature: Feature,
  used = 0,
  now = new Date(),
): boolean {
  const limit = PLAN_LIMITS[effectivePlan(org, now)][feature];
  if (typeof limit === 'boolean') return limit;
  return limit === null || used < limit;
}
