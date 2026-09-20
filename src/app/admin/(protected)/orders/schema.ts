import { z } from 'zod';

import { cardIdSchema } from '@/modules/platform';
import { ORDER_STATUSES, TRACKING_PATTERN } from '@/modules/shop';

const ORDER_INVALID = 'Поръчката не съществува.';
const QUANTITY_MESSAGE = 'Въведи цяло число от 1 до 1000.';
const TRACKING_LONG = 'Номерът на пратка е до 60 знака.';
const TRACKING_CHARS = 'Номерът на пратка: букви, цифри, интервал и - _ / .';

// Границите повтарят сервизите, за да спре формата преди базата.
export const transitionSchema = z.object({
  orderId: z.uuid(ORDER_INVALID),
  to: z.enum(ORDER_STATUSES, 'Непознат статус.'),
  trackingNumber: z
    .string()
    .trim()
    .max(60, TRACKING_LONG)
    .refine((v) => v === '' || TRACKING_PATTERN.test(v), TRACKING_CHARS)
    .optional(),
});

export const assignCardsSchema = z.object({
  orderId: z.uuid(ORDER_INVALID),
  batchId: z.uuid('Избери партида.'),
  quantity: z
    .number({ error: QUANTITY_MESSAGE })
    .int(QUANTITY_MESSAGE)
    .min(1, QUANTITY_MESSAGE)
    .max(1000, QUANTITY_MESSAGE),
});

export const releaseCardSchema = z.object({
  orderId: z.uuid(ORDER_INVALID),
  cardId: cardIdSchema,
});

export const trackingSchema = z.object({
  orderId: z.uuid(ORDER_INVALID),
  trackingNumber: z
    .string()
    .trim()
    .min(1, 'Въведи номер на пратка.')
    .max(60, TRACKING_LONG)
    .regex(TRACKING_PATTERN, TRACKING_CHARS),
});
