# syntax=docker/dockerfile:1.7

# ---------- Stage 1: builder ----------
FROM node:24-alpine AS builder
WORKDIR /app

# Enable corepack so we can run the project's pinned pnpm version.
RUN corepack enable

# Install all dependencies first (cached unless lockfile changes).
# pnpm-workspace.yaml carries the security overrides; without it,
# --frozen-lockfile aborts with ERR_PNPM_LOCKFILE_CONFIG_MISMATCH.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# Compile the TypeScript sources.
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN pnpm run build

# ---------- Stage 2: runtime ----------
FROM node:24-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    TZ=America/Caracas \
    PORT=3000

# Install tzdata so the container reports Caracas time. node-cron, ingest,
# and the daily SQL queries all depend on TZ being correct.
RUN apk add --no-cache tzdata wget && \
    cp /usr/share/zoneinfo/$TZ /etc/localtime && \
    echo $TZ > /etc/timezone

RUN corepack enable

# Install only production dependencies. The lockfile guarantees identical
# versions to the builder stage; we just skip dev deps to keep the image small.
# pnpm-workspace.yaml must be present here too (security overrides + frozen check).
COPY --chown=node:node package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --prod && \
    pnpm store prune

# Copy compiled output and DB migrations.
COPY --from=builder --chown=node:node /app/dist ./dist
COPY --chown=node:node drizzle ./drizzle

USER node

EXPOSE 3000

# Liveness probe — Railway uses HTTP healthchecks separately, but this is
# helpful for local `docker run` and other orchestrators.
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1

CMD ["node", "dist/index.js"]
