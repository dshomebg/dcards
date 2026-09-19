'use client';

import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { useQueryParams } from '@/hooks/use-query-params';

type SearchFilterProps = Readonly<{
  paramKey: string;
  label: string;
  placeholder?: string;
  submitLabel?: string;
}>;

/**
 * Търсене с ИЗРИЧЕН натиск, не при всяка буква: отзад е `ILIKE '%…%'`, което
 * сканира таблицата — по едно сканиране на клавиш.
 */
export function SearchFilter({
  paramKey,
  label,
  placeholder,
  submitLabel = 'Търси',
}: SearchFilterProps) {
  const { value, setFilters } = useQueryParams();
  const applied = value(paramKey);
  const [draft, setDraft] = useState(applied);

  // Адресът е истината: при „назад" полето трябва да покаже предишната
  // стойност, а не последното напечатано.
  useEffect(() => {
    setDraft(applied);
  }, [applied]);

  return (
    <form
      className="flex items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        setFilters({ [paramKey]: draft });
      }}
    >
      <Field
        label={label}
        type="search"
        value={draft}
        placeholder={placeholder}
        onChange={(event) => setDraft(event.target.value)}
      />

      <Button type="submit" variant="secondary">
        {submitLabel}
      </Button>
    </form>
  );
}
