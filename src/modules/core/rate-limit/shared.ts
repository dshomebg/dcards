import { redis } from '../redis/client';
import { createLimiter } from './limiter';

// Готов лимитер върху общия Redis клиент — потребителите не строят свой.
export const rateLimit = createLimiter(redis);
