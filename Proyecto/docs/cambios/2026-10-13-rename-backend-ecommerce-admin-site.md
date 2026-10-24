# Rename de apps: `rest` → `backend`, `web` → `ecommerce`, + `admin-site`

**Fecha:** 2026-10-13 · **Épica:** KAN-86 / KAN-85

- `apps/rest` → `apps/backend` y `apps/web` → `apps/ecommerce`: el nombre de
  la carpeta describe el rol de la app, no su protocolo (REST) ni su
  naturaleza técnica (web).
- Nueva `apps/admin-site` (Angular, scaffold mínimo, misma convención que
  `ecommerce`, puerto 4300): la futura interfaz de administración del sitio.

**Por qué**: dejar espacio y un nombre claro para el panel de administración,
que sirve a otro rol y no debe compartir build/deploy con el frontend de
clientes.

Las entradas anteriores de esta bitácora mencionan `apps/rest` y `apps/web`
a propósito: describen el repo en su fecha.

**Toca**: nombres de paquete (`@cotizapp/backend`, `@cotizapp/ecommerce`),
`pnpm-workspace.yaml`, `docker-compose.yml` (servicios, contenedores,
volúmenes), `infra/docker-compose.prod.yml`, `infra/nginx/nginx.conf`,
`apps/backend/Dockerfile`, `apps/ecommerce/angular.json` (proyecto,
`outputPath`, build targets), `.gitignore`, `README.md`,
`docs/ARCHITECTURE.md`, comentarios de referencia en
`packages/{application,domain,shared-config}` y `apps/mobile`.
