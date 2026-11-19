# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Cotizapp — multi-provider quotation/purchase ecommerce for food-industry SMEs (Duoc UC capstone project). Monorepo managed with **pnpm workspaces + Turborepo**. Full details in `README.md` and `docs/ARCHITECTURE.md` — read those before making non-trivial changes, they're kept up to date.

This `Proyecto/` directory is the repo root for development purposes. The parent `CAPSTONE/` repo also contains `Fase1/` (phase-1 course deliverables) — never modify anything under `Fase1/`.

## Commands

Run from `Proyecto/` (all proxy through Turborepo to every workspace):

```bash
pnpm dev          # all apps + packages in watch mode (needed for packages/* changes to reach apps/backend)
pnpm build
pnpm lint
pnpm check-types
pnpm test
```

Single package/app, via pnpm filter:

```bash
pnpm --filter=@cotizapp/backend dev        # backend on :8000
pnpm --filter=@cotizapp/ecommerce dev      # ecommerce on :4200
pnpm --filter=@cotizapp/admin-site dev     # admin-site on :4300
pnpm --filter=@cotizapp/backend test       # vitest run --passWithNoTests (same pattern in domain/application/infrastructure)
pnpm --filter=@cotizapp/ecommerce test     # ng test --watch=false
```

A single vitest file/case: `cd apps/backend && pnpm vitest run path/to/file.test.ts -t "test name"` (same for `packages/domain|application|infrastructure`).

Mobile (Flutter, not part of the pnpm workspace):

```bash
cd apps/mobile && flutter pub get && flutter run
flutter test                      # all tests
flutter test test/some_test.dart  # single file
```

Docker Compose (MySQL + backend + ecommerce + admin-site, hot-reload):

```bash
cp apps/backend/.env.example apps/backend/.env
docker compose up
docker compose up -d backend      # recreate just one service after editing its .env
```

DB migrations (Drizzle, schema lives in `packages/infrastructure/src/db/schema`):

```bash
cd packages/infrastructure
pnpm db:generate   # generate SQL migration from schema
pnpm db:migrate     # apply against DATABASE_URL
```

Env vars: `apps/backend/.env` is read by the backend (only `DATABASE_URL` is actually used; `DB_HOST`/`DB_PORT`/etc. are informational). Angular apps do **not** read `.env` — their dev config lives in `src/environments/environment.development.ts`, not `.env`.

## Architecture

Clean Architecture, strict dependency rule: `apps/backend → application → domain ← infrastructure`. `domain` is pure TypeScript and must never import from `infrastructure`, Drizzle, or MySQL.

```
packages/domain          entities, Zod DTOs, repository interfaces — no infra deps
packages/application     use cases; dependencies passed in via parameter/constructor (no DI container, no service locator)
packages/infrastructure  Drizzle schema + repository implementations (the only layer that knows about MySQL)
apps/backend             Fastify HTTP interface; routes are the composition root that wires a concrete repository + calls a use case
apps/ecommerce           Angular — single app serving both customers/SMEs and distributors (role-based routing/guards, shared session)
apps/admin-site          Angular — internal site administration, separate deploy from ecommerce (scaffold only, no features yet)
apps/mobile              Flutter — distributor-only (stats, visits, ratings); standard Flutter Clean Architecture (lib/features/<feature>/{data,domain,presentation}), Riverpod for DI/state
```

`apps/ecommerce` and `apps/admin-site` may import `@cotizapp/domain` directly (types/DTOs only, no server deps dragged in).

### Backend route convention

Routes are NOT registered with loose `app.get(...)`/`app.post(...)` calls. Each operation is a file exporting a Fastify `RouteOptions` object; a module's `index.ts` collects them into a `<modulo>Routes: RouteOptions[]` array; `src/routes/index.ts` merges all module arrays and registers them in a loop (`routes.forEach(r => app.route(r))`).

```
apps/backend/src/routes/
  categorias/
    list.ts      // listCategoriasRoute: RouteOptions
    create.ts    // createCategoriaRoute: RouteOptions
    index.ts     // categoriaRoutes: RouteOptions[]
  index.ts       // merges ...categoriaRoutes etc., registerRoutes(app)
```

Route handlers never contain business logic directly — they build a concrete repository from `request.server.db` and delegate to an `application` use case.

### Auth

Resolved entirely in `apps/backend` (neither `domain` nor `application` know a JWT exists), as composable Fastify `preHandler`s in `src/plugins/auth.ts`:
- `requireAuth` — verifies `Bearer <token>` against `JWT_SECRET`, populates `request.auth = { sub, organizacionId, rol }`, else 401.
- `requireRol(...roles)` — composes after `requireAuth`, checks `request.auth.rol`, else 403.

Apply by adding to a route's `preHandler: [...]` array — never a global hook with an exception list. `JWT_SECRET` is validated at startup via Zod (`src/config/env.ts`); the server refuses to start if missing rather than failing on first protected request.

### Reference implementation: `categoria`

`categoria` (GET/POST `/categorias`, create protected by `requireAuth` + `requireRol("administrador")`) is a complete, working example of all 4 layers wired together — use it as the template for any new entity (`producto`, `oferta`, `carro`, ...). Files, in the order they should be written:

1. `packages/domain/src/entities/categoria.entity.ts` — pure type
2. `packages/domain/src/dtos/categoria.dto.ts` — Zod schema shared between route and use case
3. `packages/domain/src/repositories/categoria.repository.ts` — repository interface (port)
4. `packages/application/src/use-cases/{listar,crear}-categoria.use-case.ts`
5. `packages/infrastructure/src/db/schema/categoria.schema.ts` — Drizzle table, 1:1 with `DataBase/dbDiagram.sql`
6. `packages/infrastructure/src/repositories/categoria.repository.ts` — `DrizzleCategoriaRepository implements CategoriaRepository`
7. `apps/backend/src/routes/categorias/{list,create,index}.ts`
8. Wired in `apps/backend/src/server/app.ts` / `src/routes/index.ts`

### Database

MySQL. Full ER model (DBML) in `DataBase/dbDiagram.sql` — the Drizzle schema under `packages/infrastructure/src/db/schema` must translate it table by table; only `categoria` is translated so far. Key entities: `organizacion`, `usuario`, `rol`, `categoria`, `producto`, `oferta` (volume/quantity pricing, not unit price), `carro`, `orden`, `orden_linea`, `orden_envio`, `documento_tributario`, `liquidacion` (simulated per-distributor payout split), `proveedor_documento`, `proveedor_cobertura`, `evento_analitico`, `auditoria_log`, `moderacion_caso`.

### Payments

Webpay/MercadoPago sandbox, consumed only from `apps/backend` (card data never touches our own backend). No native split from the gateway — the payout split across distributors is simulated in our own DB (`liquidacion` table).

### Hot-reload mechanics

`apps/backend` uses `tsx watch`. Since `packages/domain|application|infrastructure` are imported as compiled deps (not source), editing them requires Turborepo's `tsc -b --watch` (started by `pnpm dev`, not by `pnpm --filter @cotizapp/backend dev` alone) — `tsx watch` is configured to also watch their `dist/**`. Angular apps hot-reload via `ng serve`/Vite natively. `.env` changes are *not* picked up automatically — recreate the Docker service or restart the local process.

## Branching workflow

No separate `prod` branch — **`dev` is the deployed/production branch**. Per-person dev branches (`dev-benjaycosas`, `dev-sebamax`, `dev-smy`) → PR into `main` → once merged into `main`, a separate PR from `main` → `dev` ships it. Never push directly to `main` or `dev`.
