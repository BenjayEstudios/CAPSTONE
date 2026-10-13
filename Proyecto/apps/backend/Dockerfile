# Build de producción de apps/backend, corrido desde la raíz del monorepo:
#   docker build -f apps/backend/Dockerfile -t cotizapp-backend .
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=@cotizapp/domain --filter=@cotizapp/application --filter=@cotizapp/infrastructure --filter=@cotizapp/backend build

FROM node:20-alpine
WORKDIR /repo
RUN corepack enable
COPY --from=build /repo .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/backend/dist/server/index.js"]
