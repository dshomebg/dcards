// Чист модел на количката — без Next, без Redis, без цени. Цените се смятат
// при показване (`cart.service.ts`), количката носи само варианти и текст (MON-1).

import { z } from 'zod';

export const MAX_CART_LINES = 10;
export const MAX_LINE_QUANTITY = 20;

export type CartErrorCode = 'cart_full' | 'line_not_found' | 'input_invalid';

const MESSAGES: Readonly<Record<CartErrorCode, string>> = {
  cart_full: `Количката побира най-много ${MAX_CART_LINES} реда.`,
  line_not_found: 'Този ред вече не е в количката.',
  input_invalid: 'Има невалидни или твърде дълги полета.',
};

export class CartError extends Error {
  constructor(readonly code: CartErrorCode) {
    super(MESSAGES[code]);
    this.name = 'CartError';
  }
}

// Празен низ от форма е „няма" — пази се като `null`, не като `''`.
const optionalText = (max: number, tooLong: string) =>
  z
    .string()
    .trim()
    .max(max, tooLong)
    .nullish()
    .transform((value) =>
      value === undefined || value === null || value === '' ? null : value,
    );

export const cartPersonalizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Името е задължително.')
    .max(80, 'Името е до 80 знака.'),
  title: optionalText(120, 'Длъжността е до 120 знака.'),
  notes: optionalText(300, 'Бележките са до 300 знака.'),
});

export const cartQuantitySchema = z
  .int('Количеството е цяло число.')
  .min(1, 'Количеството е поне 1.')
  .max(MAX_LINE_QUANTITY, `Количеството е до ${MAX_LINE_QUANTITY}.`);

export const cartLineInputSchema = z.object({
  variantId: z.uuid('Избери вариант.'),
  quantity: cartQuantitySchema,
  personalization: cartPersonalizationSchema,
});

// `id` идва от сървъра: един вариант може да е на два реда с различни имена.
export const cartLineSchema = cartLineInputSchema.extend({
  id: z.string().min(1),
});

export const cartSchema = z.object({
  items: z.array(cartLineSchema).max(MAX_CART_LINES),
});

export type CartPersonalization = z.output<typeof cartPersonalizationSchema>;
export type CartLineInput = z.output<typeof cartLineInputSchema>;
export type CartLine = z.output<typeof cartLineSchema>;
export type Cart = z.output<typeof cartSchema>;

export function emptyCart(): Cart {
  return { items: [] };
}

/** Лош или чужд запис в Redis → празна количка, не грешка. */
export function parseCart(raw: unknown): Cart {
  const parsed = cartSchema.safeParse(raw);
  return parsed.success ? parsed.data : emptyCart();
}

export function addLine(cart: Cart, input: CartLineInput, id: string): Cart {
  const parsed = cartLineInputSchema.safeParse(input);
  if (!parsed.success) throw new CartError('input_invalid');
  if (cart.items.length >= MAX_CART_LINES) throw new CartError('cart_full');
  return { items: [...cart.items, { id, ...parsed.data }] };
}

export function updateLineQuantity(
  cart: Cart,
  id: string,
  quantity: number,
): Cart {
  const parsed = cartQuantitySchema.safeParse(quantity);
  if (!parsed.success) throw new CartError('input_invalid');
  if (!cart.items.some((line) => line.id === id)) {
    throw new CartError('line_not_found');
  }
  return {
    items: cart.items.map((line) =>
      line.id === id ? { ...line, quantity: parsed.data } : line,
    ),
  };
}

export function removeLine(cart: Cart, id: string): Cart {
  if (!cart.items.some((line) => line.id === id)) {
    throw new CartError('line_not_found');
  }
  return { items: cart.items.filter((line) => line.id !== id) };
}

/** Броят бройки, не редове — това показва header-ът. */
export function cartCount(cart: Cart): number {
  return cart.items.reduce((sum, line) => sum + line.quantity, 0);
}
