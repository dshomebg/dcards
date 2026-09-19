import { Redis } from 'ioredis';

import { env } from '../env';

const globalForRedis = globalThis as unknown as { redis?: Redis };

export const redis =
  globalForRedis.redis ??
  new Redis(env().REDIS_URL, {
    // Nginx и деплоят са пред нас; при кратък рестарт на Redis не искаме
    // лавина от опити, а един спокоен.
    maxRetriesPerRequest: 3,
    lazyConnect: true,
  });
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
