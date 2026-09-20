// Маршрутизаторът на чипа: `/c/{id}`, публичен, без auth. Route handler, а не
// страница: само той може да сложи cookie на redirect-а — маркерът „този скан е
// записан", за да не остава `?s=nfc` в адресната лента (копираният адрес е „линк").

import { NextResponse } from 'next/server';

import { db, env } from '@/modules/core';
import {
  cardIdSchema,
  classifyDevice,
  findCardForRoute,
  insertScan,
  isBot,
  logScanFailure,
  resolveCard,
} from '@/modules/platform';

import { cardRouteLimited, scanRecordLimited } from './rate-limit';
import { SCAN_SEEN_COOKIE, SCAN_SEEN_SECONDS } from './scan-seen';

export const dynamic = 'force-dynamic';

type Context = Readonly<{ params: Promise<{ id: string }> }>;

export async function GET(request: Request, context: Context) {
  // Лимитът е ПРЕДИ всякаква заявка — отказаният опит не струва нищо.
  if (await cardRouteLimited(request.headers)) {
    return new NextResponse('Твърде много заявки. Опитай пак след минута.', {
      status: 429,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  }

  const { id } = await context.params;
  const parsed = cardIdSchema.safeParse(id);
  if (!parsed.success) return new NextResponse(null, { status: 404 });

  const route = resolveCard(await findCardForRoute(db, parsed.data));
  if (route.kind === 'not_found')
    return new NextResponse(null, { status: 404 });
  if (route.kind !== 'redirect') {
    return NextResponse.redirect(
      new URL(`/c/${parsed.data}/activate`, env().APP_URL),
      307,
    );
  }

  const userAgent = request.headers.get('user-agent');
  try {
    if (!isBot(userAgent) && !(await scanRecordLimited(route.cardId))) {
      await insertScan(db, {
        cardId: route.cardId,
        profileId: route.profileId,
        orgId: route.orgId,
        source: 'nfc',
        device: classifyDevice(userAgent),
        country: null,
      });
    }
  } catch (error) {
    logScanFailure('/c', error);
  }

  // 307: профилът се сменя от dashboard-а. Cookie-то казва на `/{slug}` да не
  // брои същото отваряне като „линк"; живее секунди, не се чете от JS.
  // Базата е `APP_URL`, не `request.url`: зад nginx заявката е http към 127.0.0.1.
  const response = NextResponse.redirect(
    new URL(`/${route.slug}`, env().APP_URL),
    307,
  );
  response.cookies.set(SCAN_SEEN_COOKIE, route.slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure: env().NODE_ENV === 'production',
    path: `/${route.slug}`,
    maxAge: SCAN_SEEN_SECONDS,
  });
  return response;
}
