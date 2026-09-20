import { z } from 'zod';

/** Една схема за формата и за action-а — двете страни не могат да се разминат. */
export const orgNameSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Името трябва да е поне 2 знака.')
    .max(80, 'Твърде дълго име.'),
});

export type OrgNameInput = z.infer<typeof orgNameSchema>;

export const inviteMemberSchema = z.object({
  email: z.email('Въведи валиден имейл.').max(254),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
