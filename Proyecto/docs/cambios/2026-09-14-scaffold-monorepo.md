# Scaffold base del monorepo

**Fecha:** 2026-09-14 · **Épica:** —

Estructura base del monorepo (pnpm + Turborepo) con Clean Architecture,
siguiendo la plantilla `Estructura-projects`:

- `packages/domain`, `packages/application`, `packages/infrastructure`
  (MySQL vía Drizzle) y `packages/shared-config`.
- Apps: `apps/rest` (Fastify), `apps/web` (Angular, clientes y
  distribuidores) y `apps/mobile` (Flutter/Riverpod, en ese momento solo
  distribuidores).

**Por qué**: punto de partida del desarrollo de Cotizapp, con inyección de
dependencias explícita (sin service-locator) y sin acoplar el dominio a
Drizzle/MySQL.

**Estado al cerrar**: sin lógica de negocio ni vistas. El schema de Drizzle
todavía no traducía `DataBase/dbDiagram.sql` y no había rutas ni módulos
(`auth`, `catalogo`, `pedidos`, `pagos`) en `apps/rest`.

**Toca**: todo el repo (commit inicial del monorepo).
