import { z } from 'zod';

import {
  type cartLineInputSchema,
  cartPersonalizationSchema,
  cartQuantitySchema,
} from '@/modules/shop';

// Плоска обвивка на `cartLineInputSchema` — формата е плоска, action-ът я сгъва.
export const addToCartFormSchema = z.object({
  variantId: z.uuid('Избери вариант.'),
  quantity: cartQuantitySchema,
  ...cartPersonalizationSchema.shape,
});

export type AddToCartFormInput = z.input<typeof addToCartFormSchema>;
export type AddToCartFormValues = z.output<typeof addToCartFormSchema>;

export function toCartLineInput(
  values: AddToCartFormValues,
): z.input<typeof cartLineInputSchema> {
  const { variantId, quantity, ...personalization } = values;
  return { variantId, quantity, personalization };
}
