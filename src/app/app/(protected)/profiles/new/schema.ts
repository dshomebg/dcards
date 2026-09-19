import { z } from 'zod';

import { slugSchema } from '@/modules/platform';

// Само трите полета за старт; останалото е в редактора (PLT-5). Границите
// повтарят `createProfileInputSchema`, за да спре формата преди action-а.
export const newProfileSchema = z.object({
  slug: slugSchema,
  firstName: z.string().trim().min(1, 'Въведи име.').max(80, 'Твърде дълго.'),
  lastName: z
    .string()
    .trim()
    .min(1, 'Въведи фамилия.')
    .max(80, 'Твърде дълго.'),
});

export type NewProfileInput = z.infer<typeof newProfileSchema>;
