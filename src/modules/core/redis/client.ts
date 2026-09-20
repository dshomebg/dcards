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
    // Висящ (не паднал) Redis иначе държи всяка страница до proxy timeout-а;
    // сесия/количка при изтекло време са `null`/празна, както при паднал.
    commandTimeout: 1000,
  });
if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;
