import { sql } from 'drizzle-orm';

import { db, redis } from '@/modules/core';

// Readiness, не liveness: 200 само когато базата и Redis отговарят. Deploy-ът
// чака точно това — жив процес със счупена база не е „готов".
export async function GET() {
  const checks = { database: false, redis: false };
  try {
    await db.execute(sql`select 1`);
    checks.database = true;
  } catch {
    // остава false
  }
  try {
    checks.redis = (await redis.ping()) === 'PONG';
  } catch {
    // остава false
  }
  const ready = checks.database && checks.redis;
  // Кой компонент е паднал — само в лога (`deploy.sh` го показва): всеки на
  // споделения хост стига до порта, а хедърите се подправят.
  if (!ready) console.error('health: degraded', checks);
  return Response.json(
    { status: ready ? 'ready' : 'degraded' },
    { status: ready ? 200 : 503 },
  );
}

export const dynamic = 'force-dynamic';
