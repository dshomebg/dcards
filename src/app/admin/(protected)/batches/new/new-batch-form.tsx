'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { createBatchAction } from '../actions';
import { type NewBatchInput, newBatchSchema } from '../schema';

export function NewBatchForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewBatchInput>({
    resolver: zodResolver(newBatchSchema),
    defaultValues: { name: '', quantity: 100 },
  });

  // При успех action-ът пренасочва сам; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createBatchAction(values);
    setFormError(result.message);
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field
        label="Име"
        type="text"
        autoComplete="off"
        autoFocus
        hint="Само за админа — например доставчик и дата."
        error={errors.name?.message}
        {...register('name')}
      />

      <Field
        label="Брой карти"
        type="number"
        inputMode="numeric"
        min={1}
        max={1000}
        step={1}
        width="short"
        error={errors.quantity?.message}
        {...register('quantity', { valueAsNumber: true })}
      />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2 self-start">
        {isSubmitting ? 'Създаване…' : 'Създай партида'}
      </Button>
    </form>
  );
}
