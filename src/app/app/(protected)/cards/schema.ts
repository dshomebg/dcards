import { z } from 'zod';

import { ACTIVATION_CODE_PATTERN, cardIdSchema } from '@/modules/platform';

// Една схема за формата и за action-а. Кодът е низ, не число — „000123" е валиден.
export const claimSchema = z.object({
  cardId: cardIdSchema,
  code: z.string().trim().regex(ACTIVATION_CODE_PATTERN, 'Кодът е 6 цифри.'),
});

export type ClaimInput = z.input<typeof claimSchema>;
