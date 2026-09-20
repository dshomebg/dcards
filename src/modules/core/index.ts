import { createLimiter } from './rate-limit/limiter';
import { redis } from './redis/client';

export { type Db, db, type DbExecutor } from './db/client';
export {
  isForeignKeyViolation,
  isUniqueViolation,
  uniqueViolationConstraint,
} from './db/errors';
export { type Env, env } from './env';
export {
  IMAGE_MAX_BYTES,
  ImageError,
  type ImageErrorCode,
  LOGO_MAX_BYTES,
  LOGO_MAX_SIDE,
  PHOTO_SIDE,
  processImage,
  processLogo,
  type ProcessOptions,
  processPhoto,
  toJpeg,
} from './image';
export { type MailMessage, sendMail } from './mail/send';
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
export {
  createLogoKey,
  createObjectKey,
  deleteObject,
  isObjectKey,
  OBJECT_KEY_PATTERN,
  OBJECT_KINDS,
  type ObjectKind,
  putObject,
  readObject,
} from './storage';

// Готов лимитер върху общия Redis клиент — потребителите не строят свой.
export const rateLimit = createLimiter(redis);
