import Link from 'next/link';

import {
  formatPrice,
  type PriceFormat,
  type PublicProductSummary,
} from '@/modules/shop';

import { MATERIAL_LABELS } from './material-label';

type Props = Readonly<{
  product: PublicProductSummary;
  format: PriceFormat;
}>;

/** Карта в списъка: име, материал, „от {basePrice}" — вариантите са на страницата. */
export function ProductCard({ product, format }: Props) {
  return (
    <li>
      <Link
        href={`/products/${product.slug}`}
        className="flex h-full flex-col gap-hint rounded-(--radius-card) border border-border bg-surface p-4 shadow-(--shadow-card) hover:border-brand"
      >
        <span className="font-semibold">{product.name}</span>
        <span className="text-text-muted text-sm">
          {MATERIAL_LABELS[product.material]}
        </span>
        <span className="mt-auto text-sm">
          от {formatPrice(product.basePrice, format)}
        </span>
      </Link>
    </li>
  );
}
