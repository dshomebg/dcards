'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

import {
  applyFilters,
  applyParams,
  buildHref,
  type ParamChanges,
} from './query-params';

/**
 * Единственото място, което пише в адреса.
 *
 * Истината за филтрите е адресът, а не React състояние — оттам идват
 * споделяемата връзка и работещото „назад".
 */
export function useQueryParams() {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const router = useRouter();

  const value = useCallback(
    (key: string) => searchParams.get(key) ?? '',
    [searchParams],
  );

  const setFilters = useCallback(
    (changes: ParamChanges) => {
      // `push`, не `replace`: смяната остава в историята, иначе „назад" излиза
      // от екрана, вместо да върне предишния филтър.
      router.push(
        buildHref(
          pathname,
          applyFilters(new URLSearchParams(searchParams), changes),
        ),
      );
    },
    [pathname, router, searchParams],
  );

  const hrefWith = useCallback(
    (changes: ParamChanges) =>
      buildHref(
        pathname,
        applyParams(new URLSearchParams(searchParams), changes),
      ),
    [pathname, searchParams],
  );

  return { value, setFilters, hrefWith };
}
