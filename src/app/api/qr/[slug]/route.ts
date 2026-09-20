// `GET /api/qr/{slug}` → SVG с адреса на профила. Кеш 24 ч без `immutable` —
// съдържанието зависи от `APP_URL`, който ще се смени с краткия домейн.

import { db, env } from '@/modules/core';
import {
  findPublicProfileBySlug,
  profileUrl,
  renderQrSvg,
  slugSchema,
} from '@/modules/platform';

import { publicApiLimit } from '../../rate-limit';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<{ slug: string }> }>;

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request, ctx: Context): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slugSchema.safeParse(slug).success) return notFound();
  // Лимитът е след slug валидацията (404 без Redis) и преди базата.
  const limited = await publicApiLimit(req);
  if (limited !== null) return limited;
  const profile = await findPublicProfileBySlug(db, slug);
  if (profile === null) return notFound();

  const svg = await renderQrSvg(profileUrl(env().APP_URL, profile.slug));
  return new Response(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
