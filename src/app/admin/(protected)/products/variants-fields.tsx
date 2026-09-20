'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  type FieldErrors,
  useFieldArray,
  type UseFormRegister,
} from 'react-hook-form';

import { FormSection } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

import type {
  ProductForm,
  ProductFormValues,
  VariantFormValues,
} from './schema';

// Без `id`: нов ред → сервизът вмъква. Съществуващият носи своя id скрито.
const EMPTY_VARIANT: VariantFormValues = {
  name: '',
  priceDelta: '0.00',
  sku: '',
  stock: 0,
  isActive: true,
};

interface RowProps {
  readonly index: number;
  readonly count: number;
  readonly register: UseFormRegister<ProductFormValues>;
  readonly errors: FieldErrors<ProductFormValues>;
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (index: number) => void;
}

function VariantRow({
  index,
  count,
  register,
  errors,
  onMove,
  onRemove,
}: RowProps) {
  const rowErrors = errors.variants?.[index];
  const position = `Вариант ${index + 1}`;

  return (
    <li className="flex flex-col gap-hint rounded-(--radius-control) border border-border p-3">
      <input type="hidden" {...register(`variants.${index}.id`)} />
      <div className="grid gap-field sm:grid-cols-[1fr_7rem_10rem_7rem]">
        <Field
          label={`${position}: име`}
          labelHidden
          type="text"
          placeholder="Име"
          error={rowErrors?.name?.message}
          {...register(`variants.${index}.name`)}
        />
        <Field
          label={`${position}: разлика в цената`}
          labelHidden
          type="text"
          inputMode="decimal"
          placeholder="+/- цена"
          error={rowErrors?.priceDelta?.message}
          {...register(`variants.${index}.priceDelta`)}
        />
        <Field
          label={`${position}: SKU`}
          labelHidden
          type="text"
          placeholder="SKU"
          autoCapitalize="characters"
          error={rowErrors?.sku?.message}
          {...register(`variants.${index}.sku`)}
        />
        <Field
          label={`${position}: наличност`}
          labelHidden
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          placeholder="Наличност"
          error={rowErrors?.stock?.message}
          {...register(`variants.${index}.stock`, { valueAsNumber: true })}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Switch label="Активен" {...register(`variants.${index}.isActive`)} />
        <span className="flex-1" />
        <Button
          variant="ghost"
          className="p-1"
          aria-label={`${position}: нагоре`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ArrowUp aria-hidden size={16} />
        </Button>
        <Button
          variant="ghost"
          className="p-1"
          aria-label={`${position}: надолу`}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDown aria-hidden size={16} />
        </Button>
        <Button variant="ghost" onClick={() => onRemove(index)}>
          Премахни
        </Button>
      </div>
    </li>
  );
}

interface Props {
  readonly form: ProductForm;
}

export function VariantsFields({ form }: Props) {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: 'variants',
  });
  const listError = errors.variants?.root?.message ?? errors.variants?.message;

  return (
    <FormSection
      title="Варианти"
      description="Редът тук е редът във витрината. Цената на варианта е базовата плюс разликата."
    >
      {fields.length === 0 && (
        <p className="text-text-muted text-sm">Още няма варианти.</p>
      )}
      <ul className="flex flex-col gap-field">
        {fields.map((field, index) => (
          <VariantRow
            key={field.id}
            index={index}
            count={fields.length}
            register={register}
            errors={errors}
            onMove={swap}
            onRemove={remove}
          />
        ))}
      </ul>
      {listError !== undefined && (
        <p className="text-danger text-xs">{listError}</p>
      )}
      <div>
        <Button variant="secondary" onClick={() => append(EMPTY_VARIANT)}>
          Добави вариант
        </Button>
      </div>
    </FormSection>
  );
}
