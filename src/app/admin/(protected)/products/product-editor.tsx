'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormActions, FormLayout } from '@/components/form';
import type { ProductEditDto } from '@/modules/shop';

import { createProductAction, saveProductAction } from './actions';
import { DeleteProduct } from './delete-product';
import { ProductFields } from './product-fields';
import {
  EMPTY_PRODUCT,
  type ProductFormOutput,
  productFormSchema,
  type ProductFormValues,
  toFormValues,
} from './schema';
import { VariantsFields } from './variants-fields';

type Props =
  | { readonly mode: 'create'; readonly currency: string }
  | {
      readonly mode: 'edit';
      readonly product: ProductEditDto;
      readonly currency: string;
    };

const BACK = { href: '/admin/products', label: 'Назад към продуктите' };

export function ProductEditor(props: Props) {
  // Последно записаното: заглавието го ползва, „Отказ" връща към него.
  const [saved, setSaved] = useState<ProductEditDto | null>(
    props.mode === 'edit' ? props.product : null,
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const form = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues: saved === null ? EMPTY_PRODUCT : toFormValues(saved),
  });
  const {
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  // Резолверът връща minor units; action-ът иска низовете — прати се суровото.
  const onSubmit = handleSubmit(async () => {
    setFormError(null);
    setStatus(undefined);
    const values = form.getValues();
    if (saved === null) {
      // При успех action-ът пренасочва сам; тук стига само отказът.
      const result = await createProductAction(values);
      setFormError(result.message);
      return;
    }
    const result = await saveProductAction(saved.id, values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSaved(result.product);
    reset(toFormValues(result.product));
    setStatus('Записано.');
  });

  return (
    <FormLayout
      title={saved === null ? 'Нов продукт' : saved.name}
      subtitle="Цените са в лева; вариантите се записват заедно с продукта."
      back={BACK}
      error={formError}
      actions={
        <FormActions
          submitLabel={saved === null ? 'Създай' : 'Запази'}
          pendingLabel={saved === null ? 'Създаване…' : 'Записване…'}
          pending={isSubmitting}
          onSubmit={() => void onSubmit()}
          onCancel={() => {
            reset(saved === null ? EMPTY_PRODUCT : toFormValues(saved));
            setFormError(null);
          }}
          status={status}
        />
      }
    >
      <form
        method="post"
        onSubmit={(event) => void onSubmit(event)}
        className="flex max-w-3xl flex-col gap-8"
        noValidate
      >
        <ProductFields form={form} currency={props.currency} />
        <VariantsFields form={form} />
        {saved !== null && <DeleteProduct productId={saved.id} />}
      </form>
    </FormLayout>
  );
}
