'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { changePasswordAction } from './actions';
import {
  type ChangePasswordFormInput,
  changePasswordFormSchema,
} from './schema';

type Status = { kind: 'idle' } | { kind: 'error' | 'done'; message: string };

export function ChangePasswordForm() {
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: 'idle' });
    const result = await changePasswordAction(values);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message });
      return;
    }
    // Паролите не бива да остават в полетата след успех.
    reset();
    setStatus({ kind: 'done', message: 'Паролата е сменена.' });
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field
        label="Текуща парола"
        type="password"
        autoComplete="current-password"
        error={errors.currentPassword?.message}
        {...register('currentPassword')}
      />

      <Field
        label="Нова парола"
        type="password"
        autoComplete="new-password"
        hint="Поне 8 знака."
        error={errors.newPassword?.message}
        {...register('newPassword')}
      />

      <Field
        label="Повтори новата парола"
        type="password"
        autoComplete="new-password"
        error={errors.confirmPassword?.message}
        {...register('confirmPassword')}
      />

      {status.kind === 'error' && (
        <p role="alert" className="text-danger text-sm">
          {status.message}
        </p>
      )}

      {status.kind === 'done' && (
        <p role="status" className="text-success-ink text-sm">
          {status.message}
        </p>
      )}

      <Button type="submit" disabled={isSubmitting} className="mt-2">
        {isSubmitting ? 'Смяна…' : 'Смени паролата'}
      </Button>
    </form>
  );
}
