'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/cn';
import {
  formatPrice,
  MAX_LINE_QUANTITY,
  type PriceFormat,
  type PublicProductVariant,
} from '@/modules/shop';

import { addToCartAction } from '../../cart/actions';
import {
  type AddToCartFormInput,
  addToCartFormSchema,
  type AddToCartFormValues,
  toCartLineInput,
} from './schema';

type Props = Readonly<{
  variants: readonly PublicProductVariant[];
  format: PriceFormat;
}>;

/** Вариант, име, длъжност, бележки, количество → `addToCartAction`. */
export function AddToCartForm({ variants, format }: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddToCartFormInput, unknown, AddToCartFormValues>({
    resolver: zodResolver(addToCartFormSchema),
    defaultValues: {
      variantId: variants.find((variant) => variant.inStock)?.id ?? '',
      quantity: 1,
      name: '',
      title: '',
      notes: '',
    },
  });
  const selected = watch('variantId');

  // При успех action-ът пренасочва към `/cart`; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await addToCartAction(toCartLineInput(values));
    setFormError(result.message);
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-field"
      noValidate
    >
      <fieldset className="flex flex-col gap-hint">
        <legend className="text-label font-medium">Вариант</legend>
        {variants.map((variant) => (
          <label
            key={variant.id}
            className={cn(
              'flex items-center gap-2 text-sm',
              variant.id === selected ? 'font-medium' : 'text-text-muted',
              !variant.inStock && 'cursor-not-allowed',
            )}
          >
            <input
              type="radio"
              value={variant.id}
              disabled={!variant.inStock}
              {...register('variantId')}
            />
            <span>{variant.name}</span>
            <span>{formatPrice(variant.price, format)}</span>
            {!variant.inStock && <span className="text-xs">изчерпано</span>}
          </label>
        ))}
        {errors.variantId !== undefined && (
          <p className="text-danger text-xs">{errors.variantId.message}</p>
        )}
      </fieldset>

      <Field
        label="Име върху картата"
        type="text"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <Field
        label="Длъжност"
        type="text"
        autoComplete="organization-title"
        error={errors.title?.message}
        {...register('title')}
      />
      <Textarea
        label="Бележки"
        rows={3}
        hint="Логото ще ви поискаме по имейл след поръчката."
        error={errors.notes?.message}
        {...register('notes')}
      />
      <Field
        label="Количество"
        type="number"
        inputMode="numeric"
        min={1}
        max={MAX_LINE_QUANTITY}
        width="short"
        error={errors.quantity?.message}
        {...register('quantity', { valueAsNumber: true })}
      />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Добавяне…' : 'Добави в количката'}
      </Button>
    </form>
  );
}
