'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { type SignInInput, signInSchema, signInUser } from '@/modules/auth';

// Отделно копие от админската форма (ADM-1 § 3.3): двата входа не делят адрес и форма.
type Props = Readonly<{ next?: string | null }>;

export function LoginForm({ next = null }: Props) {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // При успех action-ът пренасочва сам; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signInUser(values, next);
    setFormError(result.message);
  });

  return (
    // `method="post"`: без JavaScript GET би пратил паролата в адреса и логовете.
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field
        label="Имейл"
        type="email"
        autoComplete="username"
        autoFocus
        error={errors.email?.message}
        {...register('email')}
      />

      <Field
        label="Парола"
        type="password"
        autoComplete="current-password"
        error={errors.password?.message}
        {...register('password')}
      />

      {formError !== null && (
        <p role="alert" className="text-danger text-sm">
          {formError}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Влизане…' : 'Вход'}
      </Button>
    </form>
  );
}
