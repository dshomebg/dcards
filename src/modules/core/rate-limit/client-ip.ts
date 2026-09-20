// Nginx презаписва `X-Real-IP` с `$remote_addr`, а към XFF само ДОБАВЯ — първият
// елемент там е под контрола на клиента. Затова XFF не се чете.

export const UNKNOWN_IP = 'unknown';

// IPv6 клиент разполага с цял /64 — ключ по пълния адрес не ограничава нищо.
function bucketOf(ip: string): string {
  if (!ip.includes(':')) return ip;
  const groups = ip.split('::')[0]?.split(':') ?? [];
  return `${groups.slice(0, 4).join(':')}::/64`;
}

/** Чист helper над `Headers` — без `next/headers`, за да остане `core` без Next. */
export function clientIpFrom(headers: Headers): string {
  const ip = headers.get('x-real-ip')?.trim();
  return ip ? bucketOf(ip) : UNKNOWN_IP;
}
