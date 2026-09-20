'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { inviteMemberAction } from './actions';
import { type InviteMemberInput, inviteMemberSchema } from './schema';

type Status = { kind: 'idle' } | { kind: 'error' | 'done'; message: string };

/** Формата е винаги; при Free баджът предупреждава, а отказът идва от сървъра. */
export function InviteForm({ proOnly }: Readonly<{ proOnly: boolean }>) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<InviteMemberInput>({
    resolver: zodResolver(inviteMemberSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setStatus({ kind: 'idle' });
    const result = await inviteMemberAction(values);
    if (!result.ok) {
      setStatus({ kind: 'error', message: result.message });
      return;
    }
    reset();
    setStatus({ kind: 'done', message: 'Поканата е изпратена.' });
    router.refresh();
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-col gap-4"
      noValidate
    >
      {proOnly && (
        <Badge tone="brand" className="self-start">
          Pro
        </Badge>
      )}

      <Field
        label="Имейл"
        type="email"
        autoComplete="off"
        hint="Поканеният става редактор: вижда и редактира профилите и картите."
        error={errors.email?.message}
        {...register('email')}
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

      <Button type="submit" disabled={isSubmitting} className="self-start">
        {isSubmitting ? 'Изпращане…' : 'Покани'}
      </Button>
    </form>
  );
}
