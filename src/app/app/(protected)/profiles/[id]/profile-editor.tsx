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
import { ProfileImages } from './profile-images';
import { type EditorPlan, ProfilePreview } from './profile-preview';
import {
  profileFormSchema,
  type ProfileFormValues,
  toFormValues,
} from './schema';

interface Props {
  readonly profile: ProfileEditDto;
  /** Изчислен на сървъра от плана на org-а — клиентът не тълкува `plan`. */
  readonly plan: EditorPlan;
  readonly appName: string;
  readonly appUrl: string;
}

export function ProfileEditor({ profile, plan, appName, appUrl }: Props) {
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
    // Ключовете са от `saved`, не от отговора: качване по време на записване
    // не бива да бъде затрито от стария DTO.
    setSaved((prev) => ({
      ...result.profile,
      photoKey: prev.photoKey,
      logoKey: prev.logoKey,
    }));
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
          <ProfileImages
            profileId={saved.id}
            photoKey={saved.photoKey}
            logoKey={saved.logoKey}
            onChange={(kind, key) =>
              setSaved((prev) => ({ ...prev, [`${kind}Key`]: key }))
            }
          />
          <ProfileFields
            form={form}
            customTheme={plan.customTheme}
            hasLogo={saved.logoKey !== null}
          />
          <LinksFields form={form} />
          <DeleteProfile profileId={saved.id} />
        </form>

        <ProfilePreview
          control={control}
          slug={saved.slug}
          images={{ photoKey: saved.photoKey, logoKey: saved.logoKey }}
          plan={plan}
          appName={appName}
          appUrl={appUrl}
        />
      </div>
    </FormLayout>
  );
}
