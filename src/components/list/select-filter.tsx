'use client';

import type { SelectOption } from '@/components/ui/select';
import { Select } from '@/components/ui/select';
import { useQueryParams } from '@/hooks/use-query-params';

type SelectFilterProps = Readonly<{
  paramKey: string;
  label: string;
  options: readonly SelectOption[];
  /** Стойността „без ограничение" — празен низ, тоест липсващ ключ в адреса. */
  anyLabel?: string;
}>;

export function SelectFilter({
  paramKey,
  label,
  options,
  anyLabel = 'Всички',
}: SelectFilterProps) {
  const { value, setFilters } = useQueryParams();

  return (
    <Select
      label={label}
      value={value(paramKey)}
      options={[{ value: '', label: anyLabel }, ...options]}
      onChange={(event) => setFilters({ [paramKey]: event.target.value })}
    />
  );
}
