// Цени и наличност на количката — от базата при всяко показване, никога от
// самата количка (MON-1/2). Точният `stock` не излиза навън.

import type { DbExecutor } from '@/modules/core';

import type { Cart, CartPersonalization } from './cart';
import {
  findVariantsWithProductByIds,
  type VariantWithProduct,
} from './product.repository';

export type CartLineUnavailableReason = 'out_of_stock' | 'unavailable';

/** Всичко изрично (DAT-7); `reason` има само при `available: false`. */
export interface CartViewLine {
  readonly id: string;
  readonly variantId: string;
  readonly productSlug: string;
  readonly productName: string;
  readonly variantName: string;
  readonly unitPrice: number;
  readonly quantity: number;
  readonly lineTotal: number;
  readonly personalization: CartPersonalization;
  readonly available: boolean;
  readonly reason?: CartLineUnavailableReason;
}

export interface CartView {
  readonly lines: readonly CartViewLine[];
  /** Само достъпните редове — недостъпният не се плаща. */
  readonly subtotal: number;
  readonly count: number;
}

const isActive = (row: VariantWithProduct): boolean =>
  row.product.isActive && row.variant.isActive;

function unavailableLine(
  line: Cart['items'][number],
  row: VariantWithProduct | undefined,
): CartViewLine {
  return {
    id: line.id,
    variantId: line.variantId,
    productSlug: row?.product.slug ?? '',
    productName: row?.product.name ?? 'Продуктът не се предлага',
    variantName: row?.variant.name ?? '',
    unitPrice: 0,
    quantity: line.quantity,
    lineTotal: 0,
    personalization: line.personalization,
    available: false,
    reason: 'unavailable',
  };
}

function viewLine(
  line: Cart['items'][number],
  row: VariantWithProduct | undefined,
): CartViewLine {
  if (row === undefined || !isActive(row)) return unavailableLine(line, row);

  const unitPrice = row.product.basePrice + row.variant.priceDelta;
  const available = row.variant.stock >= line.quantity;
  return {
    id: line.id,
    variantId: line.variantId,
    productSlug: row.product.slug,
    productName: row.product.name,
    variantName: row.variant.name,
    unitPrice,
    quantity: line.quantity,
    lineTotal: available ? unitPrice * line.quantity : 0,
    personalization: line.personalization,
    available,
    ...(available ? {} : { reason: 'out_of_stock' as const }),
  };
}

/** Една заявка за всички варианти; редът на количката се пази. */
export async function priceCart(
  executor: DbExecutor,
  cart: Cart,
): Promise<CartView> {
  const ids = [...new Set(cart.items.map((line) => line.variantId))];
  const rows = await findVariantsWithProductByIds(executor, ids);
  const byId = new Map(rows.map((row) => [row.variant.id, row]));

  const lines = cart.items.map((line) =>
    viewLine(line, byId.get(line.variantId)),
  );
  return {
    lines,
    subtotal: lines.reduce((sum, line) => sum + line.lineTotal, 0),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
  };
}

/** За „Добави": вариантът съществува и продуктът и той са активни. */
export async function isVariantActive(
  executor: DbExecutor,
  variantId: string,
): Promise<boolean> {
  const rows = await findVariantsWithProductByIds(executor, [variantId]);
  const row = rows[0];
  return row !== undefined && isActive(row);
}
