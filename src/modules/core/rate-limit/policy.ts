// Праговете и ключовете на едно място — кодът, който вика лимита, не знае числа.

export interface RatePolicy {
  readonly limit: number;
  readonly windowSec: number;
}

export const RATE_POLICY = {
  // Строгият праг е по двойката имейл+IP: иначе 5 чужди опита на 15 мин заключват
  // всеки известен имейл (вкл. админа). Глобалният по имейл пази от много IP-та.
  loginEmailIp: { limit: 5, windowSec: 900 },
  loginEmail: { limit: 30, windowSec: 3600 },
  loginIp: { limit: 20, windowSec: 900 },
  registerIp: { limit: 3, windowSec: 3600 },
  actionUser: { limit: 60, windowSec: 60 },
  apiIp: { limit: 60, windowSec: 60 },
} as const satisfies Record<string, RatePolicy>;

export const rateKey = {
  // Схемата на входа не нормализира имейла — ключът го прави, както репозиторият.
  loginEmail: (email: string) => `rl:login:email:${email.toLowerCase()}`,
  loginEmailIp: (email: string, ip: string) =>
    `rl:login:email-ip:${email.toLowerCase()}:${ip}`,
  loginIp: (ip: string) => `rl:login:ip:${ip}`,
  registerIp: (ip: string) => `rl:register:ip:${ip}`,
  actionUser: (userId: string) => `rl:action:user:${userId}`,
  apiIp: (ip: string) => `rl:api:ip:${ip}`,
} as const;

export function tooManyMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Твърде много опити. Опитай след ${minutes} минути.`;
}
