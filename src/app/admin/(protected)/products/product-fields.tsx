'use client';

import { FormSection } from '@/components/form';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

import { MATERIAL_OPTIONS, type ProductForm } from './schema';

interface Props {
  readonly form: ProductForm;
  readonly currency: string;
}

export function ProductFields({ form, currency }: Props) {
  const {
    register,
    formState: { errors },
  } = form;

  return (
    <>
      <FormSection title="Основни">
        <div className="grid gap-field sm:grid-cols-2">
          <Field
            label="Име"
            type="text"
            autoComplete="off"
            error={errors.name?.message}
            {...register('name')}
          />
          <Field
            label="Адрес"
            type="text"
            autoComplete="off"
            autoCapitalize="none"
            spellCheck={false}
            hint="Страницата на продукта е /products/{адрес}."
            error={errors.slug?.message}
            {...register('slug')}
          />
        </div>
        <Textarea
          label="Описание"
          hint="Обикновен текст, до 2000 знака."
          error={errors.description?.message}
          {...register('description')}
        />
      </FormSection>

      <FormSection title="Цена и материал">
        <div className="grid gap-field sm:grid-cols-2">
          <Select
            label="Материал"
            options={MATERIAL_OPTIONS}
            error={errors.material?.message}
            {...register('material')}
          />
          <Field
            label="Базова цена"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            width="short"
            suffix={currency}
            hint="Вариантите добавят или махат от нея."
            error={errors.basePrice?.message}
            {...register('basePrice')}
          />
        </div>
      </FormSection>

      <FormSection title="Видимост">
        <Switch
          label="Активен продукт"
          hint="Неактивният продукт не се показва във витрината."
          error={errors.isActive?.message}
          {...register('isActive')}
        />
      </FormSection>
    </>
  );
}
