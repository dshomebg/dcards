// Nginx презаписва `X-Real-IP` с `$remote_addr`, а към XFF само ДОБАВЯ — първият
// елемент там е под контрола на клиента. Затова XFF не се чете.

export const UNKNOWN_IP = 'unknown';

/** Чист helper над `Headers` — без `next/headers`, за да остане `core` без Next. */
export function clientIpFrom(headers: Headers): string {
  const ip = headers.get('x-real-ip')?.trim();
  return ip ? ip : UNKNOWN_IP;
}
