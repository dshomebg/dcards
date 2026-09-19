'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import {
  type FieldErrors,
  useFieldArray,
  type UseFormRegister,
  type UseFormReturn,
  useWatch,
} from 'react-hook-form';

import { FormSection } from '@/components/form';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Select } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { LINK_LABELS, PROFILE_LINK_TYPES } from '@/modules/platform';

import type { ProfileFormValues, ProfileLinkFormValues } from './schema';

const TYPE_OPTIONS = PROFILE_LINK_TYPES.map((type) => ({
  value: type,
  label: LINK_LABELS[type],
}));

const EMPTY_LINK: ProfileLinkFormValues = {
  type: 'website',
  label: '',
  value: '',
  isVisible: true,
};

interface RowProps {
  readonly index: number;
  readonly count: number;
  readonly register: UseFormRegister<ProfileFormValues>;
  readonly errors: FieldErrors<ProfileFormValues>;
  readonly type: ProfileLinkFormValues['type'];
  readonly onMove: (from: number, to: number) => void;
  readonly onRemove: (index: number) => void;
}

function LinkRow({
  index,
  count,
  register,
  errors,
  type,
  onMove,
  onRemove,
}: RowProps) {
  const rowErrors = errors.links?.[index];
  const position = `Линк ${index + 1}`;

  return (
    <li className="flex flex-col gap-hint rounded-(--radius-control) border border-border p-3">
      <div className="grid gap-field sm:grid-cols-[10rem_1fr_1fr]">
        <Select
          label={`${position}: тип`}
          labelHidden
          options={TYPE_OPTIONS}
          error={rowErrors?.type?.message}
          {...register(`links.${index}.type`)}
        />
        <Field
          label={`${position}: етикет`}
          labelHidden
          type="text"
          placeholder={LINK_LABELS[type]}
          error={rowErrors?.label?.message}
          {...register(`links.${index}.label`)}
        />
        <Field
          label={`${position}: стойност`}
          labelHidden
          type="text"
          placeholder="Стойност"
          error={rowErrors?.value?.message}
          {...register(`links.${index}.value`)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Switch label="Видим" {...register(`links.${index}.isVisible`)} />
        <span className="flex-1" />
        <Button
          variant="ghost"
          className="p-1"
          aria-label={`${position}: нагоре`}
          disabled={index === 0}
          onClick={() => onMove(index, index - 1)}
        >
          <ArrowUp aria-hidden size={16} />
        </Button>
        <Button
          variant="ghost"
          className="p-1"
          aria-label={`${position}: надолу`}
          disabled={index === count - 1}
          onClick={() => onMove(index, index + 1)}
        >
          <ArrowDown aria-hidden size={16} />
        </Button>
        <Button variant="ghost" onClick={() => onRemove(index)}>
          Премахни
        </Button>
      </div>
    </li>
  );
}

interface Props {
  readonly form: UseFormReturn<ProfileFormValues>;
}

export function LinksFields({ form }: Props) {
  const {
    control,
    register,
    formState: { errors },
  } = form;
  const { fields, append, remove, swap } = useFieldArray({
    control,
    name: 'links',
  });
  // Типът се гледа живо: placeholder-ът на етикета е подразбираният по тип.
  const links = useWatch({ control, name: 'links' });
  const listError = errors.links?.root?.message ?? errors.links?.message;

  return (
    // „Добави линк" е винаги активен — лимитът на плана го казва сървърът.
    <FormSection
      title="Линкове"
      description="Редът тук е редът на страницата. Скритите не се показват."
    >
      {fields.length === 0 && (
        <p className="text-text-muted text-sm">Още няма линкове.</p>
      )}
      <ul className="flex flex-col gap-field">
        {fields.map((field, index) => (
          <LinkRow
            key={field.id}
            index={index}
            count={fields.length}
            register={register}
            errors={errors}
            type={links[index]?.type ?? field.type}
            onMove={swap}
            onRemove={remove}
          />
        ))}
      </ul>
      {listError !== undefined && (
        <p className="text-danger text-xs">{listError}</p>
      )}
      <div>
        <Button variant="secondary" onClick={() => append(EMPTY_LINK)}>
          Добави линк
        </Button>
      </div>
    </FormSection>
  );
}
