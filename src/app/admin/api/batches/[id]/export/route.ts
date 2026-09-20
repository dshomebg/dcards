// `GET /admin/api/batches/{id}/export` → CSV за писача на чипове. Извън
// `(protected)` — layout-ът не пази handlers, затова админът се проверява тук.

import { z } from 'zod';

import { getCurrentAdmin } from '@/modules/auth';
import { db, env } from '@/modules/core';
import { buildCardsCsv, getBatchCsvRows } from '@/modules/platform';

import { adminActionLimit } from '../../../../(protected)/rate-limit';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<{ id: string }> }>;

/** Едно и също за чужд, непознат и невалиден — адресът не издава дали партидата съществува. */
function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(_req: Request, ctx: Context): Promise<Response> {
  const { id } = await ctx.params;
  if (!z.uuid().safeParse(id).success) return notFound();

  const admin = await getCurrentAdmin();
  if (admin === null) return notFound();

  const retryAfter = await adminActionLimit(admin.id);
  if (retryAfter !== null) {
    return new Response('Too many requests', {
      status: 429,
      headers: {
        'Retry-After': String(retryAfter),
        'Cache-Control': 'no-store',
      },
    });
  }

  const rows = await getBatchCsvRows(db, id);
  if (rows === null) return notFound();

  const { CARD_URL_BASE, APP_URL } = env();
  const csv = buildCardsCsv(rows, CARD_URL_BASE ?? APP_URL);
  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="cards-${id}.csv"`,
      // Кодовете за активация не бива да остават в никакъв кеш.
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
