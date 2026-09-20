'use client';

import { Controller, type UseFormReturn } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Switch } from '@/components/ui/switch';

import type { ProfileFormValues } from './schema';

interface Props {
  readonly form: UseFormReturn<ProfileFormValues>;
  /** `can(org, 'customTheme')` — без Pro полетата са само за гледане. */
  readonly customTheme: boolean;
  /** Логото се качва отделно от формата — без него водният знак няма какво да покаже. */
  readonly hasLogo: boolean;
}

const PRO_HINT = 'Собствен цвят и лого на фон са част от Pro.';

/** Pro полетата на темата: цвят на акцента и лого като воден знак. */
export function ThemeFields({ form, customTheme, hasLogo }: Props) {
  const {
    control,
    register,
    formState: { errors },
  } = form;

  return (
    <>
      {!customTheme && (
        <div className="flex items-center gap-2">
          <Badge tone="brand">Pro</Badge>
          <p className="text-text-muted text-hint">{PRO_HINT}</p>
        </div>
      )}

      <Controller
        control={control}
        name="theme.primaryColor"
        render={({ field }) => (
          <div className="flex items-end gap-2">
            {/* `''` при `null`: браузърът сам показва подразбирания си цвят, без hex тук. */}
            <Field
              label="Основен цвят"
              type="color"
              width="short"
              hint="Бутонът за контакт, инициалите и фирмата. Без цвят — цветът на темата."
              error={errors.theme?.primaryColor?.message}
              {...field}
              disabled={!customTheme}
              value={field.value ?? ''}
              onChange={(event) => {
                field.onChange(event.target.value);
              }}
            />
            {field.value !== null && customTheme && (
              <Button
                variant="secondary"
                onClick={() => {
                  field.onChange(null);
                }}
              >
                Без цвят
              </Button>
            )}
          </div>
        )}
      />

      <Switch
        label="Лого на фон"
        hint={
          hasLogo
            ? 'Логото се показва бледо зад съдържанието.'
            : 'Първо качи лого в „Снимка и лого".'
        }
        disabled={!customTheme || !hasLogo}
        error={errors.theme?.logoBackground?.message}
        {...register('theme.logoBackground')}
      />
    </>
  );
}
