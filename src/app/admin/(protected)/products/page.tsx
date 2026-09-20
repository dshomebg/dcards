import { Package } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { type Column, DataTable, ListState } from '@/components/list';
import { Badge } from '@/components/ui/badge';
import { buttonStyles } from '@/components/ui/button';
import { db, env } from '@/modules/core';
import {
  type AdminProductSummary,
  formatPrice,
  listProductsForAdmin,
  type PriceFormat,
} from '@/modules/shop';

import { requireAdmin } from '../current';
import { MATERIAL_LABELS } from './schema';

export const metadata: Metadata = { title: 'Продукти' };

function columns(price: PriceFormat): readonly Column<AdminProductSummary>[] {
  return [
    {
      key: 'name',
      header: 'Име',
      cell: (product) => (
        <Link href={`/admin/products/${product.id}`} className="font-medium">
          {product.name}
        </Link>
      ),
    },
    {
      key: 'material',
      header: 'Материал',
      cell: (product) => MATERIAL_LABELS[product.material],
    },
    {
      key: 'basePrice',
      header: 'Базова цена',
      className: 'text-right whitespace-nowrap',
      cell: (product) => formatPrice(product.basePrice, price),
    },
    {
      key: 'variants',
      header: 'Варианти',
      className: 'text-right',
      cell: (product) => product.variantCount,
    },
    {
      key: 'status',
      header: 'Състояние',
      cell: (product) =>
        product.isActive ? (
          <Badge tone="success">Активен</Badge>
        ) : (
          <Badge tone="neutral">Неактивен</Badge>
        ),
    },
  ];
}

export default async function ProductsPage() {
  await requireAdmin();
  const products = await listProductsForAdmin(db);
  const { STORE_CURRENCY, STORE_LOCALE } = env();

  return (
    <main className="flex flex-col gap-6 px-6 py-10">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Продукти</h1>
        <Link href="/admin/products/new" className={buttonStyles()}>
          Нов продукт
        </Link>
      </div>

      {products.length === 0 ? (
        <ListState
          icon={Package}
          title="Още няма продукти"
          hint="Продуктът е карта с материал и базова цена; вариантите добавят цвят, SKU и наличност."
          action={
            <Link href="/admin/products/new" className={buttonStyles()}>
              Нов продукт
            </Link>
          }
        />
      ) : (
        <DataTable
          caption="Продукти"
          columns={columns({ currency: STORE_CURRENCY, locale: STORE_LOCALE })}
          rows={products}
          rowKey={(product) => product.id}
        />
      )}
    </main>
  );
}
