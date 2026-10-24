# Auth por rutas (`preHandler`) y rutas como `RouteOptions`

**Fecha:** 2026-09-22 · **Épica:** KAN-88

- `apps/rest/src/plugins/auth.ts` con `requireAuth` / `requireRol(...)` como
  `preHandler` de Fastify. `POST /categorias` quedó protegido con
  `requireRol("administrador")` a modo de ejemplo.
- Cada operación exporta un `RouteOptions` suelto (`list.ts`, `create.ts`),
  agrupado en un arreglo por módulo (`categoriaRoutes: RouteOptions[]`) y
  registrado con un loop en `routes/index.ts`. Es la forma de organizar
  rutas del proyecto CMV (la estructura, no los nombres).
- `JWT_SECRET` entra al schema de Zod de `src/config/env.ts`. Antes se leía
  directo de `process.env` sin validar y el server arrancaba igual,
  fallando recién en el primer request protegido.

**Por qué**: dejar un patrón de referencia de autenticación en dos capas
(`requireAuth` = ¿estás logueado?, `requireRol` = ¿tienes permiso?),
consistente con otros proyectos del equipo, y que la config faltante falle
al arrancar.

**Ojo (a futuro)**: el rol de ejemplo `administrador` no coincide con el
código real del seed (`admin_general`). Ver
[decisiones abiertas](../decisiones/DECISIONES-ABIERTAS.md).

**Toca**: `apps/rest/src/plugins/auth.ts`, `apps/rest/src/routes/**`,
`apps/rest/src/config/env.ts`, `apps/rest/package.json` (`jsonwebtoken`),
`README.md`, `docs/ARCHITECTURE.md`.
