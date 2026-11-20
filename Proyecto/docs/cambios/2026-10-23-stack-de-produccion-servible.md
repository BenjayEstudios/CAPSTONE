# Stack de producción servible: frontend en la imagen de Nginx

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-158

- Nueva imagen `infra/nginx/Dockerfile`: compila `apps/ecommerce` en un stage
  de Node y lo sirve como SPA (fallback a `index.html`, caché inmutable para
  assets con hash, `no-cache` para `index.html`), con `/api/` proxeado al
  backend.
- Config de Nginx como plantilla (`infra/nginx/templates`, `snippets`); la
  imagen oficial aplica `envsubst` con `${APP_DOMAIN}`. Reemplaza a
  `infra/nginx/nginx.conf`.
- Puerto del backend unificado en **8000** en todos lados.
- Producción usa el **MySQL del compose**; Aiven queda como base de
  desarrollo. Toda la config productiva va en un solo `infra/.env`.

**Dockerfile del backend**: no construía (node:20 con pnpm 11, que exige
Node ≥ 22.13) y horneaba `apps/backend/.env` con credenciales en la imagen,
porque no había `.dockerignore`. Ahora es multi-stage, Node 22, solo
dependencias de producción, usuario `node`: 345 MB en vez de 923 MB. El
nuevo `Proyecto/.dockerignore` excluye todos los `.env`.

**Por qué**: dejar el droplet desplegable con frontend + API + BD sin pasos
manuales de build. Los motivos de cada alternativa descartada están en
[decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md).

**Toca**: `infra/nginx/*` (nuevo; borra `nginx.conf`),
`infra/docker-compose.prod.yml`, `infra/.env.example`, `infra/README.md`,
`apps/backend/Dockerfile`, `Proyecto/.dockerignore` (nuevo).
