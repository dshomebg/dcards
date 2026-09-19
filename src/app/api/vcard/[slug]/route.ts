// `GET /api/vcard/{slug}` → `.vcf` без auth. Невалиден slug → 404 без заявка
// (DAT-8); скрит и непознат профил са неразличими (DAT-7).

import { db, env } from '@/modules/core';
import {
  buildVCard,
  findPublicProfileBySlug,
  profileUrl,
  slugSchema,
  vcardContentDisposition,
} from '@/modules/platform';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<{ slug: string }> }>;

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(_req: Request, ctx: Context): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slugSchema.safeParse(slug).success) return notFound();
  const profile = await findPublicProfileBySlug(db, slug);
  if (profile === null) return notFound();

  const body = buildVCard(profile, profileUrl(env().APP_URL, profile.slug));
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/vcard; charset=utf-8',
      'Content-Disposition': vcardContentDisposition(profile),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
