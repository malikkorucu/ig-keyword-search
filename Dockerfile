# syntax=docker/dockerfile:1.7
# Targets: `api` (also used by the worker with a different command) and `web`.

FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/web apps/web
RUN pnpm --filter @igw/shared build \
 && pnpm --filter @igw/api build \
 && pnpm --filter @igw/web build \
 && pnpm --filter @igw/api deploy --prod /out/api

# ---------- api / worker ----------
FROM node:22-bookworm-slim AS api
ENV NODE_ENV=production TZ=UTC TESSERACT_CACHE_DIR=/app/.tesseract-cache
WORKDIR /app
COPY --from=build /out/api ./
# Bake tur+eng traineddata into the image so the OCR worker never depends on a CDN at runtime.
RUN mkdir -p "$TESSERACT_CACHE_DIR" \
 && node -e "require('tesseract.js').createWorker('tur+eng',1,{cachePath:process.env.TESSERACT_CACHE_DIR}).then(w=>w.terminate())" \
 && test -s "$TESSERACT_CACHE_DIR/tur.traineddata" && test -s "$TESSERACT_CACHE_DIR/eng.traineddata" \
 && chown -R node:node /app
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/main.js"]

# ---------- web (static panel + /api reverse proxy) ----------
FROM nginx:1.27-alpine AS web
ENV API_UPSTREAM=http://api:3000
COPY apps/web/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80
