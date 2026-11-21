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
RUN pnpm install --offline --frozen-lockfile --filter "@cotizapp/ecommerce" --filter "@cotizapp/admin-site"
# Configuración "production" (default de angular.json): environment.ts con
# apiUrl "/api", es decir, mismo origen que cada frontend. Cada app se sirve
# en la raíz de su propio (sub)dominio, así que no hace falta --base-href.
RUN pnpm --filter "@cotizapp/ecommerce" --filter "@cotizapp/admin-site" build

FROM nginx:1.30-alpine
# La imagen oficial pasa las plantillas *.template por envsubst al arrancar
# y deja el resultado en /etc/nginx/conf.d/. Solo reemplaza variables de
# entorno definidas, así que $uri, $host, etc. quedan intactas. Hay dos
# plantillas (templates/http y templates/https); 18-esquema.envsh elige cuál
# según PUBLIC_SCHEME (KAN-159).
COPY infra/nginx/templates /etc/nginx/templates
COPY infra/nginx/snippets /etc/nginx/snippets
# Scripts del entrypoint: 18 y 19 corren antes de envsubst (plantilla y tope
# de subidas); 40 después (recarga periódica del certificado en HTTPS).
COPY --chmod=755 infra/nginx/entrypoint/ /docker-entrypoint.d/
# Angular 18 (builder "application") deja los estáticos en <outputPath>/browser.
COPY --from=build /repo/apps/ecommerce/dist/ecommerce/browser /usr/share/nginx/html/ecommerce
COPY --from=build /repo/apps/admin-site/dist/admin-site/browser /usr/share/nginx/html/admin-site
