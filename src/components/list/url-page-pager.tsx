'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

import { PAGE_PARAM } from '@/hooks/query-params';
import { useQueryParams } from '@/hooks/use-query-params';

import { PagePager } from './page-pager';

/** `PagePager` върху адреса: страницата е `?page=`, филтрите остават. */
export function UrlPagePager({
  page,
  pageCount,
}: Readonly<{ page: number; pageCount: number }>) {
  const router = useRouter();
  const { hrefWith } = useQueryParams();
  const [pending, startTransition] = useTransition();

  return (
    <PagePager
      page={page}
      pageCount={pageCount}
      disabled={pending}
      onPage={(next) => {
        startTransition(() => {
          router.push(
            hrefWith({ [PAGE_PARAM]: next === 1 ? undefined : String(next) }),
          );
        });
      }}
    />
  );
}
