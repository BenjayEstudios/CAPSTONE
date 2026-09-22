# Arquitectura — Cotizapp

Ecommerce centralizado de cotización y compra multiproveedor (pymes/emprendedores
del rubro alimenticio comprando a múltiples distribuidoras). Ver contexto de
producto completo en la documentación de Fase 1 (Capstone) del proyecto de título.

Esta estructura sigue la plantilla `Estructura-projects` (monorepo pnpm +
Turborepo, Clean Architecture), adaptada al stack definido para Cotizapp:
**Angular + Fastify + MySQL + Digital Ocean**.

## Monorepo

- Gestor: **pnpm workspaces** + **Turborepo** (cache/orquestación de `build`, `dev`, `lint`, `test`).
- `apps/mobile` (Flutter) queda fuera de `pnpm-workspace.yaml` porque usa su
  propio gestor de paquetes (`pub`), pero convive en el mismo repo por
  conveniencia de contexto compartido.

## Capas (clean architecture)

```
domain          →  entidades, DTOs, interfaces de repositorio (puro TypeScript, sin infraestructura)
application     →  casos de uso; reciben sus dependencias (repos, servicios) por parámetro/constructor
infrastructure  →  implementación real de las interfaces de domain/ (Drizzle + MySQL)
apps/rest       →  capa de interfaz HTTP; las rutas de Fastify arman las dependencias
                    (composition root) y llaman a los casos de uso de application/
```

Regla de dependencia: `apps/rest` → `application` → `domain` ← `infrastructure`.
`infrastructure` depende de `domain` (implementa sus interfaces) pero `domain`
nunca depende de `infrastructure` ni de Drizzle/MySQL directamente.

`apps/web` puede importar `@cotizapp/domain` (tipos/DTOs) sin arrastrar
dependencias de servidor, ya que ese paquete es TypeScript puro.

## Backend (`apps/rest`)

- Fastify + TypeScript. `src/server/app.ts` expone un `buildApp()` que arma la
  instancia de Fastify (plugins, manejo de errores) y actúa como
  **composition root**: conecta Drizzle una sola vez (`app.decorate("db", db)`)
  y registra las rutas. Cada ruta arma su propio repositorio con
  `request.server.db` y lo pasa al caso de uso de `application` correspondiente.
- Sin service-locator ni contenedor de DI: todo se conecta explícitamente,
  sin variables globales ni módulos con estado compartido.
- **Rutas**: cada módulo de negocio (`auth`, `catalogo`, `pedidos`, `pagos`)
  vive en `src/routes/<modulo>/`, con un archivo por operación que exporta un
  `RouteOptions` de Fastify (ej. `list.ts`, `create.ts`), agrupados en un
  `index.ts` (`<modulo>Routes: RouteOptions[]`). `src/routes/index.ts` junta
  todos los arreglos y los registra con un loop (`routes.forEach(r => app.route(r))`).
  `categorias` es el módulo de referencia — ver el recorrido paso a paso en
  el [README](../README.md#convención-de-rutas-http).
- **Seguridad**: la autenticación/autorización se resuelve con `preHandler`
  de Fastify (`requireAuth`, `requireRol(...)` en `src/plugins/auth.ts`),
  aplicados por ruta — nunca un hook global con lista de excepciones. Ni
  `domain` ni `application` conocen la existencia de un JWT. Detalle completo
  en el [README](../README.md#autenticación-y-autorización-en-las-rutas).
- Drizzle: schema y migraciones viven en `packages/infrastructure`, dialecto MySQL.

## Frontend web (`apps/web`)

- Angular + TypeScript. Una sola app para **clientes/pymes** y
  **distribuidores**, con enrutamiento y guards por rol (no dos apps
  separadas) — ambos roles comparten sesión, catálogo y componentes de UI base.
- Estructura feature-based: `src/app/features/<feature>/` (ej. `catalogo`,
  `comparador`, `carrito`, `checkout`, `panel-distribuidor`).
- `src/app/core/` para lo transversal: cliente HTTP (interceptors de auth),
  estado de sesión, guards de rol.

## Mobile (`apps/mobile`)

- Flutter, **exclusiva para distribuidores** (estadísticas, visitas,
  calificaciones — sin catálogo de compra ni checkout).
- Clean Architecture estándar: `lib/features/<feature>/{data,domain,presentation}`.
- Riverpod para inyección de dependencias y manejo de estado.
- `lib/core/` para código transversal (red, router, tema, errores).

## Base de datos

MySQL. El modelo entidad-relación completo (DBML) vive en
`../DataBase/dbDiagram.sql` — entidades principales: `organizacion`,
`usuario`, `rol`, `categoria`, `producto`, `oferta` (precio por
volumen/cantidad, no precio unitario), `carro`, `orden`, `orden_linea`,
`orden_envio`, `documento_tributario`, `liquidacion` (reparto simulado por
distribuidor), `proveedor_documento`, `proveedor_cobertura`,
`evento_analitico`, `auditoria_log`, `moderacion_caso`. El schema de Drizzle
en `packages/infrastructure/src/db/schema` debe traducir ese modelo —
`categoria` ya está traducida como ejemplo de referencia (ver más abajo), el
resto todavía no.

Migraciones: `pnpm --filter @cotizapp/infrastructure db:generate` genera el
SQL a partir del schema de Drizzle; `db:migrate` lo aplica contra
`DATABASE_URL`.

## Pagos

Integración con Webpay/MercadoPago en modo sandbox, consumida solo desde
`apps/rest` (los datos de tarjeta nunca tocan el backend propio). El reparto
(split) entre distribuidores es simulado en base de datos propia — no hay
split nativo de la pasarela — y se refleja en la tabla `liquidacion`.

## Infraestructura

Un solo droplet de Digital Ocean, todo en contenedores Docker: Nginx
(reverse proxy) + API (Fastify) + MySQL. Ver `infra/`.

## Ejemplo de referencia: `categoria`

Para que quede claro cómo se conectan las capas al agregar una feature
nueva, hay un caso de uso completo implementado de punta a punta —listar y
crear categorías (`GET/POST /categorias`, la segunda protegida con
`requireAuth`/`requireRol("administrador")`)— recorriendo las 4 capas:
`packages/domain/src/{entities,dtos,repositories}/categoria.*`,
`packages/application/src/use-cases/{listar,crear}-categoria.use-case.ts`,
`packages/infrastructure/src/{db/schema,repositories}/categoria.*` y
`apps/rest/src/routes/categorias/{list,create,index}.ts`. El recorrido paso
a paso está en el [README](../README.md#cómo-agregar-una-funcionalidad-nueva-ejemplo-de-referencia-categoria)
raíz — úsenlo como plantilla para el resto de entidades (`producto`,
`oferta`, `carro`...).

## Estado actual

Scaffold base con un caso de uso end-to-end implementado (`categoria`, ver
arriba) a modo de ejemplo; el resto de módulos de negocio (`auth`,
`catalogo`, `pedidos`, `pagos`) y las vistas de `apps/web`/`apps/mobile`
todavía no.
