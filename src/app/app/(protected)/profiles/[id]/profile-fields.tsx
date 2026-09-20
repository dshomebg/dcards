'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';

import { FormSection } from '@/components/form';
import { Field } from '@/components/ui/field';
import { RadioGroup } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { type ProfileFormValues, THEME_OPTIONS } from './schema';
import { ThemeFields } from './theme-fields';

interface Props {
  readonly form: UseFormReturn<ProfileFormValues>;
  readonly customTheme: boolean;
  readonly hasLogo: boolean;
}

// Смяната на адреса не пипа чипа (`/c/{card_id}`), но чупи споделеното и QR-а.
const SLUG_HINT =
  'Чипът на картата не зависи от адреса. Споделени линкове и вече свалени QR кодове ще спрат да работят.';

export function ProfileFields({ form, customTheme, hasLogo }: Props) {
  const {
    register,
    control,
    formState: { errors },
  } = form;

  return (
    <>
      <FormSection title="Основни">
        <div className="grid gap-field sm:grid-cols-2">
          <Field
            label="Име"
            type="text"
            autoComplete="given-name"
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
            label="Длъжност"
            type="text"
            autoComplete="organization-title"
            error={errors.title?.message}
            {...register('title')}
          />
          <Field
            label="Фирма"
            type="text"
            autoComplete="organization"
            error={errors.company?.message}
            {...register('company')}
          />
        </div>
        <Textarea
          label="Кратко представяне"
          hint="До 600 знака. Показва се под името."
          error={errors.bio?.message}
          {...register('bio')}
        />
      </FormSection>

      <FormSection title="Адрес">
        <Field
          label="Адрес"
          type="text"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          width="medium"
          hint={SLUG_HINT}
          error={errors.slug?.message}
          {...register('slug')}
        />
      </FormSection>

      {/* Без цветни мостри — живото превю е мострата. */}
      <FormSection title="Тема">
        <Controller
          control={control}
          name="theme.preset"
          render={({ field }) => (
            <RadioGroup
              label="Тема"
              value={field.value}
              options={THEME_OPTIONS}
              onChange={(value) => {
                field.onChange(value);
              }}
              error={errors.theme?.preset?.message}
            />
          )}
        />
        <ThemeFields form={form} customTheme={customTheme} hasLogo={hasLogo} />
      </FormSection>

      <FormSection title="Видимост">
        <Switch
          label="Публичен профил"
          hint="Скритият профил дава 404 на /{адрес}."
          error={errors.isPublic?.message}
          {...register('isPublic')}
        />
      </FormSection>
    </>
  );
}
