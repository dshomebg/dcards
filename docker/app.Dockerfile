# syntax=docker/dockerfile:1
#
# Приложението (Next.js, standalone). Строи се ЛОКАЛНО — сървърът няма Node.
#
#   docker build -f docker/app.Dockerfile -t dcards-app-prod:<sha> .

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ---------------------------------------------------------------- зависимости
FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,id=pnpm-dcards,target=/pnpm/store \
    pnpm install --frozen-lockfile

# ------------------------------------------------------------------- строене
FROM deps AS build
ENV NEXT_TELEMETRY_DISABLED=1
# `next build` импортира всеки route, а `env()` се валидира при импорт (db/redis
# клиентите). Няма `.env` в образа — стойностите тук са само за строене, нищо не
# се свързва; истинската среда идва от compose при пускане.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build     REDIS_URL=redis://127.0.0.1:6379
COPY . .
# SESSION_SECRET само за тази команда — като ENV Docker го брои за тайна в образа.
RUN SESSION_SECRET=build-only-placeholder-not-used-at-runtime pnpm build

# -------------------------------------------------------------------- работа
# Същият образ пуска и миграциите, и първия админ: `migrate.mjs` и `seed-admin.mjs`
# са бъндълнати от `pnpm build` (в `standalone/`), така че не носим tsx заради тях.
# `argon2` е native и остава external — standalone вече го съдържа в node_modules.
FROM base AS runtime
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads
USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
