'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { FormActions, FormLayout } from '@/components/form';
import type { ProfileEditDto } from '@/modules/platform';

import { saveProfileAction } from './actions';
import { DeleteProfile } from './delete-profile';
import { LinksFields } from './links-fields';
import { ProfileFields } from './profile-fields';
import { ProfilePreview } from './profile-preview';
import {
  profileFormSchema,
  type ProfileFormValues,
  toFormValues,
} from './schema';

interface Props {
  readonly profile: ProfileEditDto;
  readonly appName: string;
  readonly appUrl: string;
}

export function ProfileEditor({ profile, appName, appUrl }: Props) {
  // Последно записаното: превюто ползва неговия slug, „Отказ" връща към него.
  const [saved, setSaved] = useState(profile);
  const [formError, setFormError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | undefined>(undefined);

  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: toFormValues(profile),
  });
  const {
    control,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = form;

  // Успехът връща DTO и формата се подменя с него — без `router.refresh()`.
  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    setStatus(undefined);
    const result = await saveProfileAction(saved.id, values);
    if (!result.ok) {
      setFormError(result.message);
      return;
    }
    setSaved(result.profile);
    reset(toFormValues(result.profile));
    setStatus('Записано.');
  });

  return (
    <FormLayout
      title={`${saved.firstName} ${saved.lastName}`}
      subtitle="Промените се виждат в превюто веднага, на страницата — след записване."
      back={{ href: '/app', label: 'Назад към профилите' }}
      error={formError}
      actions={
        <FormActions
          submitLabel="Запази"
          pendingLabel="Записване…"
          pending={isSubmitting}
          onSubmit={() => void onSubmit()}
          onCancel={() => {
            reset(toFormValues(saved));
            setFormError(null);
          }}
          status={status}
        />
      }
    >
      <div className="grid gap-8 wide:grid-cols-[minmax(0,1fr)_22rem]">
        <form
          method="post"
          onSubmit={(event) => void onSubmit(event)}
          className="flex flex-col gap-8"
          noValidate
        >
          <ProfileFields form={form} />
          <LinksFields form={form} />
          <DeleteProfile profileId={saved.id} />
        </form>

        <ProfilePreview
          control={control}
          slug={saved.slug}
          appName={appName}
          appUrl={appUrl}
        />
      </div>
    </FormLayout>
  );
}
