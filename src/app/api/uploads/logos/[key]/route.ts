// `GET /api/uploads/logos/{uuid}.webp` → логото от тома. Ключът е uuid, без
// листване; съдържанието под ключ не се мени → година кеш, `immutable`.

import { isObjectKey, readObject } from '@/modules/core';

import { publicApiLimit } from '../../../rate-limit';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<{ key: string }> }>;

function notFound(): Response {
  return new Response('Not found', {
    status: 404,
    headers: { 'Cache-Control': 'no-store' },
  });
}

export async function GET(req: Request, ctx: Context): Promise<Response> {
  const { key } = await ctx.params;
  const objectKey = `logos/${key}`;
  if (!isObjectKey(objectKey)) return notFound();
  // Лимитът е след валидацията (404 без Redis) и преди диска.
  const limited = await publicApiLimit(req);
  if (limited !== null) return limited;
  const data = await readObject(objectKey);
  if (data === null) return notFound();

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      'Content-Type': 'image/webp',
      'Content-Length': String(data.byteLength),
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
