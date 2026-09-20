import type { Metadata } from 'next';

import { env } from '@/modules/core';

import { requireAdmin } from '../../current';
import { ProductEditor } from '../product-editor';

export const metadata: Metadata = { title: 'Нов продукт' };

export default async function NewProductPage() {
  await requireAdmin();
  return <ProductEditor mode="create" currency={env().STORE_CURRENCY} />;
}
