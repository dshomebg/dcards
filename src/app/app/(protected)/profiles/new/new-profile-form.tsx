'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { createProfileAction } from './actions';
import { type NewProfileInput, newProfileSchema } from './schema';

export function NewProfileForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<NewProfileInput>({
    resolver: zodResolver(newProfileSchema),
    defaultValues: { slug: '', firstName: '', lastName: '' },
  });

  // При успех action-ът пренасочва сам; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await createProfileAction(values);
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
        autoComplete="given-name"
        autoFocus
        error={errors.firstName?.message}
        {...register('firstName')}
      />

      <Field
        label="Фамилия"
        type="text"
        autoComplete="family-name"
        error={errors.lastName?.message}
        {...register('lastName')}
      />

      <Field
        label="Адрес"
        type="text"
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        hint="Малки латински букви, цифри и тире; 3–30 знака. Става адресът на профила."
        error={errors.slug?.message}
        {...register('slug')}
      />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Създаване…' : 'Създай профил'}
      </Button>
    </form>
  );
}
