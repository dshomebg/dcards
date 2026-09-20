import { z } from 'zod';

const QUANTITY_MESSAGE = 'Въведи цяло число от 1 до 1000.';

// Границите повтарят `createBatchInputSchema`, за да спре формата преди action-а.
export const newBatchSchema = z.object({
  name: z.string().trim().min(1, 'Въведи име.').max(80, 'Твърде дълго.'),
  quantity: z
    .number({ error: QUANTITY_MESSAGE })
    .int(QUANTITY_MESSAGE)
    .min(1, QUANTITY_MESSAGE)
    .max(1000, QUANTITY_MESSAGE),
});

export type NewBatchInput = z.infer<typeof newBatchSchema>;
