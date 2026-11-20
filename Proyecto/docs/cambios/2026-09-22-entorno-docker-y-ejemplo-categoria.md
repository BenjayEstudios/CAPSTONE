# Entorno de desarrollo con Docker Compose y ejemplo end-to-end

**Fecha:** 2026-09-22 · **Épica:** KAN-88

`docker-compose.yml` en la raíz de `Proyecto/` levanta MySQL + backend +
frontend con un solo comando (`docker compose up`), con hot-reload real:
bind mount + `tsx watch` / `ng serve`, y `turbo run dev` con
`envMode: loose` para que el watch de `packages/domain|application|infrastructure`
también reinicie el backend.

De paso:

- Logger propio en `apps/rest/src/lib/logger.ts` (logs estructurados).
- Endpoint `GET /health-check` y una vista de status en `apps/web` (`/`) que
  lo consume, para verificar que todo levantó.
- `.env.dev` / `.env.prod` de referencia en `apps/rest`.
- **Primer caso de uso end-to-end**: `categoria` (listar/crear), recorriendo
  las 4 capas, como plantilla de Clean Architecture. Ver
  [arquitectura](../arquitectura/ARQUITECTURA.md#ejemplo-de-referencia-categoria).

**Por qué**: que cualquiera del equipo pueda clonar y desarrollar sin
resolver a mano Node/pnpm/MySQL, y que haya un ejemplo concreto de cómo se
conectan las capas al agregar una feature.

**Toca**: `docker-compose.yml`, `turbo.json`, `apps/rest/package.json`,
`packages/{domain,application,infrastructure}/package.json`,
`apps/rest/src/{lib/logger.ts,server,routes}`,
`apps/web/src/{app,environments}`, `apps/web/angular.json`, `README.md`,
`docs/ARCHITECTURE.md` (hoy `docs/arquitectura/`).
