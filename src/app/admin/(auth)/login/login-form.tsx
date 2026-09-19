'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { signIn, type SignInInput, signInSchema } from '@/modules/auth';

export function LoginForm() {
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignInInput>({
    // Същата схема, която валидира и в action-а — една дефиниция за двете страни.
    resolver: zodResolver(signInSchema),
    defaultValues: { email: '', password: '' },
  });

  // При успех action-ът пренасочва сам; тук стига само отказът.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await signIn(values);
    setFormError(result.message);
  });

  return (
    // `method="post"` стои за деня без JavaScript: подразбиращото се GET би
    // пратило паролата в адреса — и оттам в историята и логовете на nginx.
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
