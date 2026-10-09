import Link from 'next/link';

import { uploadUrl } from '@/lib/upload-url';
import {
  formatPrice,
  type PriceFormat,
  type PublicProductSummary,
} from '@/modules/shop';

import { CardMockup } from '../card-mockup';
import { MATERIAL_LABELS } from './material-label';

type Props = Readonly<{
  product: PublicProductSummary;
  format: PriceFormat;
  /** Надписът на илюстрацията, когато продуктът още няма снимка. */
  appName: string;
}>;

/** Карта в списъка: основна снимка (или илюстрация), име, материал, „от {basePrice}". */
export function ProductCard({ product, format, appName }: Props) {
  return (
    <li>
      <Link
        href={`/products/${product.slug}`}
        className="group flex h-full flex-col gap-hint overflow-hidden rounded-(--radius-card) border border-border bg-surface shadow-(--shadow-card) transition-colors hover:border-brand"
      >
        <div className="flex aspect-square items-center justify-center bg-surface-muted p-6">
          {product.imageKey === null ? (
            <CardMockup name={appName} size="sm" />
          ) : (
            <img
              src={uploadUrl(product.imageKey)}
              alt={product.name}
              width={400}
              height={400}
              loading="lazy"
              className="size-full object-contain transition-transform group-hover:scale-[1.03]"
            />
          )}
        </div>
        <div className="flex flex-1 flex-col gap-hint p-4">
          <span className="text-xs font-medium tracking-wide text-text-muted uppercase">
            {MATERIAL_LABELS[product.material]}
          </span>
          <span className="font-semibold">{product.name}</span>
          <span className="mt-auto pt-2 font-semibold text-brand">
            от {formatPrice(product.basePrice, format)}
          </span>
        </div>
      </Link>
    </li>
  );
}
