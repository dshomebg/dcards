'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { register, type RegisterInput, registerSchema } from '@/modules/auth';

type Props = Readonly<{ next?: string | null }>;

export function RegisterForm({ next = null }: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register: field,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    // Същата схема, която валидира и в action-а — една дефиниция за двете страни.
    resolver: zodResolver(registerSchema),
    defaultValues: { name: '', email: '', password: '' },
  });

  // При успех action-ът пренасочва сам; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await register(values, next);
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
        autoComplete="name"
        autoFocus
        error={errors.name?.message}
        {...field('name')}
      />

      <Field
        label="Имейл"
        type="email"
        autoComplete="username"
        error={errors.email?.message}
        {...field('email')}
      />

      <Field
        label="Парола"
        type="password"
        autoComplete="new-password"
        hint="Поне 8 знака."
        error={errors.password?.message}
        {...field('password')}
      />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Създаване…' : 'Регистрация'}
      </Button>
    </form>
  );
}
