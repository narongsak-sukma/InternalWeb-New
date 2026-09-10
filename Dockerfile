# syntax=docker/dockerfile:1

# ==============================================================================
# KB J Capital Intranet — production image
#
# Multi-stage build (node:20-alpine):
#   build   : full install + `npm run build`
#             → dist/ static assets (vite) + dist/server.cjs (esbuild bundle)
#   runtime : production node_modules only (--packages=external means the
#             server bundle still requires packages at runtime), non-root uid.
#
# Required environment at runtime (see .env.production.example):
#   DATABASE_URL, SESSION_SECRET, ADMIN_USERNAME, ADMIN_PASSWORD
# Optional: UPLOAD_DIR (default /app/uploads — mount a writable volume there)
# ==============================================================================

# --- Stage 1: build -----------------------------------------------------------
FROM node:20-alpine AS build
WORKDIR /app

# Install the exact dependency tree first so this layer is cached across
# source-only edits (needs devDependencies: vite + esbuild + typescript).
COPY package.json package-lock.json ./
RUN npm ci

# Build frontend (vite → dist/) and server bundle (esbuild → dist/server.cjs)
COPY . .
RUN npm run build

# --- Stage 2: runtime ---------------------------------------------------------
FROM node:20-alpine AS runtime
WORKDIR /app

LABEL org.opencontainers.image.title="KB J Capital Intranet" \
      org.opencontainers.image.description="Corporate intranet web + CMS (Express gateway + React SPA)"

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0 \
    UPLOAD_DIR=/app/uploads

# Production dependencies only. The server bundle is built with
# --packages=external, so it imports from node_modules at runtime.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Built artifacts: SPA static assets + server.cjs (+ sourcemap)
COPY --from=build /app/dist ./dist

# Dedicated unprivileged runtime user (fixed uid 10001, matches k8s manifests)
RUN addgroup -g 10001 app \
    && adduser -u 10001 -G app -S -H app \
    && mkdir -p /app/uploads \
    && chown -R 10001:10001 /app/uploads \
    && chmod 750 /app/uploads

USER 10001:10001

EXPOSE 3000

# BusyBox wget ships with alpine (curl does not).
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/healthz || exit 1

CMD ["node", "dist/server.cjs"]
