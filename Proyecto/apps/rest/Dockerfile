# Build de producción de apps/rest, corrido desde la raíz del monorepo:
#   docker build -f apps/rest/Dockerfile -t cotizapp-rest .
FROM node:20-alpine AS build
WORKDIR /repo
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter=@cotizapp/domain --filter=@cotizapp/application --filter=@cotizapp/infrastructure --filter=@cotizapp/rest build

FROM node:20-alpine
WORKDIR /repo
RUN corepack enable
COPY --from=build /repo .
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/rest/dist/server/index.js"]
