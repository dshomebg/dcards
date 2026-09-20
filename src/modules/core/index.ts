import { createLimiter } from './rate-limit/limiter';
import { redis } from './redis/client';

export { type Db, db, type DbExecutor } from './db/client';
export { isUniqueViolation, uniqueViolationConstraint } from './db/errors';
export { type Env, env } from './env';
export { clientIpFrom } from './rate-limit/client-ip';
export {
  createLimiter,
  type RateLimiter,
  type RateLimitResult,
  type RateLimitStore,
} from './rate-limit/limiter';
export {
  RATE_POLICY,
  rateKey,
  type RatePolicy,
  tooManyMessage,
} from './rate-limit/policy';
export { redis } from './redis/client';

// Готов лимитер върху общия Redis клиент — потребителите не строят свой.
export const rateLimit = createLimiter(redis);
