'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';

import { claimCardAction } from './actions';
import { type ClaimInput, claimSchema } from './schema';

/** „Добави карта": id + 6-цифрен код от гърба на картата → `assigned`. */
export function ClaimCardForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ClaimInput>({
    resolver: zodResolver(claimSchema),
    defaultValues: { cardId: '', code: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    const result = await claimCardAction(values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    reset();
    router.refresh();
  });

  return (
    <form
      method="post"
      onSubmit={(event) => void onSubmit(event)}
      className="flex flex-wrap items-end gap-4"
      noValidate
    >
      <Field
        label="Id на картата"
        type="text"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        placeholder="ABCD2345"
        width="medium"
        error={errors.cardId?.message}
        {...register('cardId')}
      />
      <Field
        label="Код"
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="000000"
        width="short"
        error={errors.code?.message}
        {...register('code')}
      />
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Добавяне…' : 'Добави карта'}
      </Button>

      {formError !== null && (
        <p role="alert" className="text-danger w-full text-sm">
          {formError}
        </p>
      )}
    </form>
  );
}
