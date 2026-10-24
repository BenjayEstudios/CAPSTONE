# Imagen de Nginx de producción: compila los frontends Angular y los sirve
# como estáticos junto con el reverse proxy hacia la API. Se construye desde
# la raíz del monorepo (Proyecto/):
#   docker build -f infra/nginx/Dockerfile -t cotizapp-nginx .
# Lo usa infra/docker-compose.prod.yml. Ver infra/README.md.
FROM node:22-alpine AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --offline --frozen-lockfile --filter "@cotizapp/ecommerce"
# Configuración "production" (default de angular.json): environment.ts con
# apiUrl "/api", es decir, mismo origen que el frontend.
RUN pnpm --filter "@cotizapp/ecommerce" build

FROM nginx:1.30-alpine
# La imagen oficial pasa /etc/nginx/templates/*.template por envsubst al
# arrancar y deja el resultado en /etc/nginx/conf.d/. Solo reemplaza
# variables de entorno definidas, así que $uri, $host, etc. quedan intactas.
COPY infra/nginx/templates /etc/nginx/templates
COPY infra/nginx/snippets /etc/nginx/snippets
# Angular 18 (builder "application") deja los estáticos en <outputPath>/browser.
COPY --from=build /repo/apps/ecommerce/dist/ecommerce/browser /usr/share/nginx/html/ecommerce
