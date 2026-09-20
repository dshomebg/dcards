// `GET /api/vcard/{slug}` → `.vcf` без auth. Невалиден slug → 404 без заявка
// (DAT-8); скрит и непознат профил са неразличими (DAT-7).

import { db, env, readObject, toJpeg } from '@/modules/core';
import {
  buildVCard,
  findPublicProfileBySlug,
  profileUrl,
  slugSchema,
  vcardContentDisposition,
} from '@/modules/platform';

import { publicApiLimit } from '../../rate-limit';

export const dynamic = 'force-dynamic';

/** По-малка от записаната (512): `.vcf` е за контакт, не за екран. */
const PHOTO_SIDE = 256;

type Context = Readonly<{ params: Promise<{ slug: string }> }>;

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

/** Липсващ или повреден файл → vCard без PHOTO, не 500; контактът е по-важен. */
async function photoJpeg(key: string | null): Promise<Buffer | undefined> {
  if (key === null) return undefined;
  try {
    const webp = await readObject(key);
    return webp === null ? undefined : await toJpeg(webp, PHOTO_SIDE);
  } catch (error) {
    console.error(
      'vcard photo:',
      error instanceof Error ? error.name : 'error',
    );
    return undefined;
  }
}

export async function GET(req: Request, ctx: Context): Promise<Response> {
  const { slug } = await ctx.params;
  if (!slugSchema.safeParse(slug).success) return notFound();
  // Лимитът е след slug валидацията (404 без Redis) и преди базата.
  const limited = await publicApiLimit(req);
  if (limited !== null) return limited;
  const profile = await findPublicProfileBySlug(db, slug);
  if (profile === null) return notFound();

  const body = buildVCard(profile, profileUrl(env().APP_URL, profile.slug), {
    jpeg: await photoJpeg(profile.photoKey),
  });
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
