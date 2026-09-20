import { z } from 'zod';

import {
  COURIERS,
  orderCustomerSchema,
  type PlaceOrderInput,
} from '@/modules/shop';

// Плоска форма; суми и цени НЕ са тук — сървърът ги смята от базата (MON-1).
export const checkoutFormSchema = z
  .object({
    ...orderCustomerSchema.shape,
    courier: z.enum(COURIERS, 'Избери куриер.'),
    deliveryKind: z.enum(['address', 'office']),
    address: z.string().trim().max(300, 'Адресът е до 300 знака.'),
    office: z.string().trim().max(120, 'Офисът е до 120 знака.'),
    note: z.string().trim().max(300, 'Бележката е до 300 знака.'),
    paymentMethod: z.literal('cod'),
  })
  .superRefine((values, ctx) => {
    if (values.deliveryKind === 'address' && values.address === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'Въведи адрес за доставка.',
      });
    }
    if (values.deliveryKind === 'office' && values.office === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['office'],
        message: 'Въведи офис на куриера.',
      });
    }
  });

export type CheckoutFormInput = z.input<typeof checkoutFormSchema>;
export type CheckoutFormValues = z.output<typeof checkoutFormSchema>;

/** Само каквото сервизът иска; неизбраното от адрес/офис става `null`. */
export function toPlaceOrderInput(
  values: CheckoutFormValues,
): Pick<PlaceOrderInput, 'customer' | 'shipping'> {
  const byAddress = values.deliveryKind === 'address';
  return {
    customer: {
      name: values.name,
      phone: values.phone,
      email: values.email,
    },
    shipping: {
      courier: values.courier,
      address: byAddress ? values.address : null,
      office: byAddress ? null : values.office,
      note: values.note === '' ? null : values.note,
    },
  };
}
