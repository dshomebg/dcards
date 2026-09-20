'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { renameOrganizationAction } from './actions';
import { type OrgNameInput, orgNameSchema } from './schema';

type Status = { kind: 'idle' } | { kind: 'error' | 'done'; message: string };

export function OrgNameForm({ name }: Readonly<{ name: string }>) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<OrgNameInput>({
    resolver: zodResolver(orgNameSchema),
    defaultValues: { name },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: 'idle' });
    const result = await renameOrganizationAction(values);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message });
      return;
    }
    setStatus({ kind: 'done', message: 'Името е записано.' });
    router.refresh();
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      <Field
        label="Име на организацията"
        type="text"
        autoComplete="organization"
        error={errors.name?.message}
        {...register('name')}
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

      <Button
        type="submit"
        variant="secondary"
        disabled={isSubmitting || !isDirty}
        className="self-start"
      >
        {isSubmitting ? 'Запис…' : 'Запази'}
      </Button>
    </form>
  );
}
