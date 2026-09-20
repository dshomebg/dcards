// Надписи и грешки около плана на организацията — `plan.ts` остава чиста
// логика за лимитите.

import type { Organization } from './organization.schema';

export const PLAN_LABELS: Readonly<Record<Organization['plan'], string>> = {
  free: 'Free',
  pro: 'Pro',
};

export type OrganizationErrorCode =
  | 'org_not_found'
  | 'plan_limit_members'
  | 'already_member'
  | 'invite_self'
  | 'invite_pending'
  | 'invite_not_found'
  | 'member_not_found';

const MESSAGES: Readonly<Record<OrganizationErrorCode, string>> = {
  org_not_found: 'Организацията не съществува.',
  plan_limit_members: 'Поканите за членове са част от плана Pro.',
  already_member: 'Този човек вече е член на организацията.',
  invite_self: 'Това е твоят имейл — ти вече си собственик.',
  invite_pending: 'Към този имейл вече има чакаща покана.',
  invite_not_found: 'Поканата не съществува.',
  member_not_found: 'Този член не е в организацията.',
};

/** `code` е за тестовете; `message` е за човека. */
export class OrganizationError extends Error {
  constructor(readonly code: OrganizationErrorCode) {
    super(MESSAGES[code]);
    this.name = 'OrganizationError';
  }
}
