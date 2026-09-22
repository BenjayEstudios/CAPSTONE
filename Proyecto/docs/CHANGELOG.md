# Changelog

Bitácora de cambios relevantes (features, decisiones de arquitectura,
refactors grandes). Cada entrada: fecha, qué cambió, por qué, y qué carpetas
toca.

## 2026-09-22 — Auth por rutas (preHandler) + rutas como RouteOptions

Se agregó `apps/rest/src/plugins/auth.ts` (`requireAuth`/`requireRol`, como
`preHandler` de Fastify) y se protegió `POST /categorias` con
`requireRol("administrador")` a modo de ejemplo. Se reestructuraron las
rutas de `apps/rest` para que cada operación exporte un objeto `RouteOptions`
suelto (`list.ts`, `create.ts`), agrupado en un arreglo por módulo
(`categoriaRoutes: RouteOptions[]`) y registrado con un loop en
`routes/index.ts`, siguiendo el mismo patrón estructural de rutas del
proyecto CMV (no los nombres, la forma de organizar/registrar). Se agregó
`JWT_SECRET` al schema de Zod de `apps/rest/src/config/env.ts` — antes se
leía directo de `process.env` sin validar, y el server arrancaba igual si
faltaba, fallando recién en el primer request protegido.

**Por qué**: dejar un patrón de referencia de autenticación/autorización por
rutas (dos capas: `requireAuth` = ¿estás logueado?, `requireRol` = ¿tenés
permiso?), consistente con cómo se organizan las rutas en otros proyectos
del equipo, y que la configuración faltante falle rápido al arrancar en vez
de a mitad de un request.

**Toca**: `apps/rest/src/plugins/auth.ts`, `apps/rest/src/routes/**`,
`apps/rest/src/config/env.ts`, `apps/rest/package.json` (dependencia
`jsonwebtoken`), `README.md`, `docs/ARCHITECTURE.md`.

## 2026-09-22 — Entorno de desarrollo con Docker Compose + ejemplo end-to-end

Se agregó `docker-compose.yml` en la raíz para levantar MySQL + backend +
frontend con un solo comando (`docker compose up`), con hot-reload real
(bind mount + `tsx watch`/`ng serve`, y `turbo run dev` con `envMode: loose`
para que el watch de `packages/domain|application|infrastructure` también
reinicie `apps/rest`). Se agregó un logger propio en `apps/rest/src/lib/logger.ts`
para logs estructurados en consola, un endpoint `GET /health-check`, y una
vista de status en `apps/web` (`/`) que lo consume para verificar que todo
levantó bien. Se agregaron `.env.dev`/`.env.prod` de referencia en
`apps/rest`.

Se implementó el primer caso de uso end-to-end (`categoria`: listar/crear)
como ejemplo de referencia de Clean Architecture — ver
`docs/ARCHITECTURE.md#ejemplo-de-referencia-categoria` y el README raíz.

**Por qué**: para que el resto del equipo pueda clonar el repo y ponerse a
desarrollar (frontend o backend) sin tener que resolver a mano el setup de
Node/pnpm/MySQL, y para que quede un ejemplo concreto de cómo se conectan
`domain`/`application`/`infrastructure`/`apps/rest` al agregar una feature
nueva.

**Toca**: `docker-compose.yml`, `turbo.json`, `apps/rest/package.json`,
`packages/{domain,application,infrastructure}/package.json`,
`apps/rest/src/{lib/logger.ts,server,routes}`, `apps/web/src/{app,environments}`,
`apps/web/angular.json`, `README.md`, `docs/ARCHITECTURE.md`.

## 2026-09-14 — Scaffold base del monorepo

Se creó la estructura base del monorepo (pnpm + Turborepo) con Clean
Architecture, siguiendo la plantilla `Estructura-projects`: `packages/domain`,
`packages/application`, `packages/infrastructure` (MySQL vía Drizzle),
`packages/shared-config`, y las apps `apps/rest` (Fastify), `apps/web`
(Angular — clientes y distribuidores) y `apps/mobile` (Flutter/Riverpod —
solo distribuidores).

**Por qué**: punto de partida del proyecto de título Cotizapp (Fase 1 —
Capstone), con inyección de dependencias explícita (sin service-locator) y
sin acoplar el dominio a Drizzle/MySQL.

**Toca**: todo el repo (commit inicial). Sin lógica de negocio ni vistas
todavía — el schema de `packages/infrastructure/src/db/schema` aún no
traduce el modelo de `DataBase/dbDiagram.sql`, y no hay rutas ni módulos
(`auth`, `catalogo`, `pedidos`, `pagos`) implementados en `apps/rest`.
