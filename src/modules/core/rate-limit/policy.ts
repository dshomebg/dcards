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
  // По-строг от общия таван: сесия в чужди ръце не бива да познава текущата
  // парола с 60 опита/мин.
  passwordChangeUser: { limit: 5, windowSec: 900 },
  // Всяко „Изпрати отново" е писмо към чужд SMTP — 3/час стигат на реален човек.
  verifyResendUser: { limit: 3, windowSec: 3600 },
  apiIp: { limit: 60, windowSec: 60 },
  // Claim с 6-цифрен код: 5/час на карта прави отгатването безнадеждно;
  // 10/час на потребител спира обхождане на много карти от един акаунт.
  claimUser: { limit: 10, windowSec: 3600 },
  claimCard: { limit: 5, windowSec: 3600 },
  // Записите в `scans` са без auth — таван по карта над всяко реално сканиране.
  scanCard: { limit: 30, windowSec: 60 },
  // QR/линк записите на `/{slug}` — същият таван, ключ по профил.
  scanProfile: { limit: 30, windowSec: 60 },
  // Количката е без auth — таван по IP над всяко реално пазаруване.
  cartIp: { limit: 60, windowSec: 60 },
  // Нова количка = нов Redis ключ с TTL 7 дни без auth — реален гост прави една.
  cartNewIp: { limit: 10, windowSec: 3600 },
  // Checkout е без auth и пише в базата — по IP и по имейл, броят се и успехите.
  checkoutIp: { limit: 5, windowSec: 3600 },
  checkoutEmail: { limit: 3, windowSec: 3600 },
  // Качване на лого без auth: всяко е sharp + запис на диска — 10/час на IP.
  uploadIp: { limit: 10, windowSec: 3600 },
} as const satisfies Record<string, RatePolicy>;

export const rateKey = {
  // Схемата на входа не нормализира имейла — ключът го прави, както репозиторият.
  loginEmail: (email: string) => `rl:login:email:${email.toLowerCase()}`,
  loginEmailIp: (email: string, ip: string) =>
    `rl:login:email-ip:${email.toLowerCase()}:${ip}`,
  loginIp: (ip: string) => `rl:login:ip:${ip}`,
  registerIp: (ip: string) => `rl:register:ip:${ip}`,
  actionUser: (userId: string) => `rl:action:user:${userId}`,
  passwordChangeUser: (userId: string) => `rl:password:user:${userId}`,
  verifyResendUser: (userId: string) => `rl:verify-resend:user:${userId}`,
  apiIp: (ip: string) => `rl:api:ip:${ip}`,
  claimUser: (userId: string) => `rl:claim:user:${userId}`,
  claimCard: (cardId: string) => `rl:claim:card:${cardId}`,
  scanCard: (cardId: string) => `rl:scan:card:${cardId}`,
  scanProfile: (profileId: string) => `rl:scan:profile:${profileId}`,
  cartIp: (ip: string) => `rl:cart:ip:${ip}`,
  cartNewIp: (ip: string) => `rl:cart-new:ip:${ip}`,
  checkoutIp: (ip: string) => `rl:checkout:ip:${ip}`,
  checkoutEmail: (email: string) => `rl:checkout:email:${email.toLowerCase()}`,
  uploadIp: (ip: string) => `rl:upload:ip:${ip}`,
} as const;

export function tooManyMessage(retryAfterSec: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSec / 60));
  return `Твърде много опити. Опитай след ${minutes} минути.`;
}
