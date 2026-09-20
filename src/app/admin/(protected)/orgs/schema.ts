import { z } from 'zod';

import { localDay } from '@/modules/platform';

export const PLANS = ['free', 'pro'] as const;

const DATE_MESSAGE = 'Дата като 2026-12-31.';
const PAST_MESSAGE = 'Датата е минала — избери днес или по-късно.';

/** `free` губи датата винаги; `pro` иска бъдеща дата по София или празно = безсрочно. */
export const planFormSchema = z
  .object({
    orgId: z.uuid('Организацията не съществува.'),
    plan: z.enum(PLANS, 'Непознат план.'),
    expiresOn: z.union([z.iso.date(DATE_MESSAGE), z.literal('')]),
  })
  .transform((value) => ({
    orgId: value.orgId,
    plan: value.plan,
    expiresOn:
      value.plan === 'pro' && value.expiresOn !== '' ? value.expiresOn : null,
  }))
  .refine(
    (value) =>
      value.expiresOn === null || value.expiresOn >= localDay(new Date()),
    { message: PAST_MESSAGE, path: ['expiresOn'] },
  );

export type PlanFormValues = z.output<typeof planFormSchema>;
