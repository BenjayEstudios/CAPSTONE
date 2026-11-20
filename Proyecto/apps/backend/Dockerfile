# Build de producción de apps/backend, corrido desde la raíz del monorepo
# (Proyecto/), que es el contexto de build:
#   docker build -f apps/backend/Dockerfile -t cotizapp-backend .
# Lo usa infra/docker-compose.prod.yml. Ver infra/README.md.
#
# Node 22: pnpm@11.17.0 (packageManager del package.json raíz) exige
# Node >= 22.13, con node:20 `corepack enable` + `pnpm install` fallan.
FROM node:22-alpine AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo

FROM base AS build
# `pnpm fetch` solo necesita el lockfile: esta capa queda cacheada mientras
# no cambien las dependencias, aunque cambie el código.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
# "@cotizapp/backend..." = backend + sus dependencias del workspace
# (domain, application, infrastructure, shared-config). No instala Angular.
RUN pnpm install --offline --frozen-lockfile --filter "@cotizapp/backend..."
RUN pnpm --filter "@cotizapp/backend..." build

FROM build AS prod-deps
# node_modules desde cero solo con dependencias de producción: `pnpm fetch`
# dejó en node_modules/.pnpm TODO el lockfile (Angular, turbo...) y un
# install --prod encima no lo limpia. Los dist/ ya compilados se mantienen.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
 && pnpm install --offline --frozen-lockfile --prod --filter "@cotizapp/backend..."

FROM node:22-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8000 \
    UPLOADS_DIR=/data/uploads
# Solo lo necesario para ejecutar: manifests, dist/ y node_modules (los
# symlinks de pnpm son relativos, así que se respeta la misma estructura).
COPY --from=prod-deps /repo/package.json /repo/pnpm-workspace.yaml ./
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/packages/domain/package.json ./packages/domain/
COPY --from=prod-deps /repo/packages/domain/dist ./packages/domain/dist
COPY --from=prod-deps /repo/packages/domain/node_modules ./packages/domain/node_modules
COPY --from=prod-deps /repo/packages/application/package.json ./packages/application/
COPY --from=prod-deps /repo/packages/application/dist ./packages/application/dist
COPY --from=prod-deps /repo/packages/application/node_modules ./packages/application/node_modules
COPY --from=prod-deps /repo/packages/infrastructure/package.json ./packages/infrastructure/
COPY --from=prod-deps /repo/packages/infrastructure/dist ./packages/infrastructure/dist
COPY --from=prod-deps /repo/packages/infrastructure/node_modules ./packages/infrastructure/node_modules
# Migraciones SQL + journal: las aplica el paso de migraciones del deploy con
#   node packages/infrastructure/dist/db/migrar/run.js
# (drizzle-orm, dependencia de producción; drizzle-kit no está en la imagen).
COPY --from=prod-deps /repo/packages/infrastructure/migrations ./packages/infrastructure/migrations
COPY --from=prod-deps /repo/apps/backend/package.json ./apps/backend/
COPY --from=prod-deps /repo/apps/backend/dist ./apps/backend/dist
COPY --from=prod-deps /repo/apps/backend/node_modules ./apps/backend/node_modules
# Archivos subidos (UPLOADS_DIR). /repo es de root y el proceso corre como
# node, así que va en un directorio propio. Al montar un volumen nuevo
# encima, Docker copia este dueño, así que el volumen también queda de node.
RUN mkdir -p /data/uploads && chown node:node /data/uploads
USER node
EXPOSE 8000
CMD ["node", "apps/backend/dist/server/index.js"]
