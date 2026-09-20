import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';

import { db, env } from '@/modules/core';
import { getProductForEdit } from '@/modules/shop';

import { requireAdmin } from '../../current';
import { ProductEditor } from '../product-editor';

export const metadata: Metadata = { title: 'Продукт' };

type Props = Readonly<{ params: Promise<{ id: string }> }>;

// Сесията първо (без нея е `/admin/login`, не 404); не-UUID → 404 без заявка.
export default async function ProductPage(props: Props) {
  await requireAdmin();
  const { id } = await props.params;
  if (!z.uuid().safeParse(id).success) notFound();

  const product = await getProductForEdit(db, id);
  if (product === null) notFound();

  return (
    <ProductEditor
      mode="edit"
      product={product}
      currency={env().STORE_CURRENCY}
    />
  );
}
