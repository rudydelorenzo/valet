# syntax=docker/dockerfile:1

# ── deps: install all dependencies (dev + prod) ─────────────────────
FROM node:24-slim AS deps
WORKDIR /app
# better-sqlite3 normally installs prebuilt binaries; these are a
# compile-time fallback if prebuilds are unavailable for a platform.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ── build: produce the standalone server bundle ─────────────────────
FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── runtime ──────────────────────────────────────────────────────────
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
# Drizzle migrations are applied automatically at startup from ./drizzle
COPY --from=build /app/drizzle ./drizzle

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:3000/api/setup').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"

CMD ["node", "server.js"]
