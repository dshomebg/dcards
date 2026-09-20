'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import {
  Controller,
  type FieldErrors,
  useForm,
  type UseFormRegister,
} from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { RadioGroup } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { uploadUrl } from '@/lib/upload-url';
import {
  type CartView,
  COURIER_LABELS,
  COURIERS,
  formatPrice,
  type PriceFormat,
} from '@/modules/shop';

import { placeOrderAction } from './actions';
import {
  type CheckoutFormInput,
  checkoutFormSchema,
  type CheckoutFormValues,
} from './schema';

type Props = Readonly<{
  view: CartView;
  format: PriceFormat;
  shippingCost: number;
  defaultValues: Readonly<{ name: string; email: string }>;
}>;

const COURIER_OPTIONS = COURIERS.map((value) => ({
  value,
  label: COURIER_LABELS[value],
}));

const DELIVERY_OPTIONS = [
  { value: 'address', label: 'До адрес' },
  { value: 'office', label: 'До офис' },
] as const;

/** Само показване — сумите се смятат наново на сървъра (MON-1). */
function OrderSummary({
  view,
  format,
  shippingCost,
}: Readonly<Pick<Props, 'view' | 'format' | 'shippingCost'>>) {
  return (
    <section
      aria-label="Преглед на поръчката"
      className="flex flex-col gap-hint rounded-(--radius-card) border border-border bg-surface p-4"
    >
      <ul className="flex flex-col gap-hint text-sm">
        {view.lines.map((line) => (
          <li key={line.id} className="flex justify-between gap-4">
            <span className="flex items-center gap-hint">
              {line.personalization.logoKey !== null && (
                <img
                  src={uploadUrl(line.personalization.logoKey)}
                  alt="Лого"
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-(--radius-control) border border-border object-contain"
                />
              )}
              <span>
                {line.productName}
                {line.variantName !== '' && ` · ${line.variantName}`} ×{' '}
                {line.quantity}
                <span className="text-text-muted block">
                  {line.personalization.name}
                </span>
              </span>
            </span>
            <span>{formatPrice(line.lineTotal, format)}</span>
          </li>
        ))}
      </ul>
      <dl className="flex flex-col gap-hint border-t border-border pt-2 text-sm">
        <div className="flex justify-between">
          <dt>Продукти</dt>
          <dd>{formatPrice(view.subtotal, format)}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Доставка</dt>
          <dd>{formatPrice(shippingCost, format)}</dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>Общо</dt>
          <dd>{formatPrice(view.subtotal + shippingCost, format)}</dd>
        </div>
      </dl>
    </section>
  );
}

type FieldsProps = Readonly<{
  register: UseFormRegister<CheckoutFormInput>;
  errors: FieldErrors<CheckoutFormInput>;
}>;

function CustomerFields({ register, errors }: FieldsProps) {
  return (
    <>
      <Field
        label="Име и фамилия"
        type="text"
        autoComplete="name"
        error={errors.name?.message}
        {...register('name')}
      />
      <Field
        label="Телефон"
        type="tel"
        autoComplete="tel"
        width="medium"
        error={errors.phone?.message}
        {...register('phone')}
      />
      <Field
        label="Имейл"
        type="email"
        autoComplete="email"
        error={errors.email?.message}
        {...register('email')}
      />
    </>
  );
}

/** Картовото плащане е „скоро" — native radio с `disabled`, `RadioGroup` няма такова. */
function PaymentChoice({ register }: Pick<FieldsProps, 'register'>) {
  return (
    <fieldset className="flex flex-col gap-hint">
      <legend className="text-label font-medium">Плащане</legend>
      <label className="flex items-center gap-1.5 text-sm font-medium">
        <input type="radio" value="cod" {...register('paymentMethod')} />
        Наложен платеж (при доставка)
      </label>
      <label className="text-text-muted flex items-center gap-1.5 text-sm">
        <input
          type="radio"
          value="card"
          disabled
          {...register('paymentMethod')}
        />
        С карта <span className="text-xs">(скоро)</span>
      </label>
    </fieldset>
  );
}

export function CheckoutForm({
  view,
  format,
  shippingCost,
  defaultValues,
}: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormInput, unknown, CheckoutFormValues>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: {
      name: defaultValues.name,
      phone: '',
      email: defaultValues.email,
      courier: 'econt',
      deliveryKind: 'office',
      address: '',
      office: '',
      note: '',
      paymentMethod: 'cod',
    },
  });
  const deliveryKind = watch('deliveryKind');

  // При успех action-ът пренасочва към `/order/{number}`; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await placeOrderAction(values);
    setFormError(result.message);
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-field"
      noValidate
    >
      <CustomerFields register={register} errors={errors} />

      <Controller
        control={control}
        name="courier"
        render={({ field }) => (
          <RadioGroup
            label="Куриер"
            value={field.value}
            options={COURIER_OPTIONS}
            onChange={field.onChange}
            error={errors.courier?.message}
          />
        )}
      />
      <Controller
        control={control}
        name="deliveryKind"
        render={({ field }) => (
          <RadioGroup
            label="Доставка"
            value={field.value}
            options={DELIVERY_OPTIONS}
            onChange={field.onChange}
          />
        )}
      />
      {deliveryKind === 'address' ? (
        <Field
          label="Адрес за доставка"
          type="text"
          autoComplete="street-address"
          error={errors.address?.message}
          {...register('address')}
        />
      ) : (
        <Field
          label="Офис на куриера"
          type="text"
          error={errors.office?.message}
          {...register('office')}
        />
      )}
      <Textarea
        label="Бележка към поръчката"
        rows={3}
        error={errors.note?.message}
        {...register('note')}
      />

      <PaymentChoice register={register} />
      <OrderSummary view={view} format={format} shippingCost={shippingCost} />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Изпращане…' : 'Поръчай'}
      </Button>
    </form>
  );
}
