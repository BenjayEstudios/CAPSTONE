# Modelo de calificaciones de proveedores

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-142

Nueva tabla `calificacion` (migración `0002_calificacion.sql`): una por envío
entregado (UNIQUE en `orden_envio_id`), puntaje 1-5 con `CHECK`, comentario
opcional, quién califica y cuándo.

- Puerto `CalificacionRepository` en `packages/domain` e implementación
  `DrizzleCalificacionRepository` (`registrar`, `resumenPorProveedor`,
  `listarPorProveedor`). `registrar` usa `INSERT ... SELECT` para que solo se
  pueda calificar un envío entregado y desde la organización compradora.
- El promedio por proveedor se calcula con una consulta, no con columnas
  agregadas en `organizacion` (motivo en
  [decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md)).
- `DbClient` ya no exige un `Pool` (acepta una conexión única) y hay un
  helper `consultar()` para los `SELECT` escritos con `` sql`...` ``.
- Primeros tests de integración en `packages/infrastructure/test/` (se saltan
  en CI, que no tiene MySQL).

**Seed ampliado**: de 2 a 11 órdenes (las 1 y 2 sin cambios), 16
calificaciones, cortes de liquidación semanales por proveedor (antes uno por
envío) y guías/facturas con el receptor correcto. El costo de despacho se
deriva del umbral de despacho gratis y de la tarifa RM de cobertura del
proveedor.

**Por qué**: el comparador y la pestaña "Reseñas" de mobile necesitan la
reputación de cada proveedor.

**Toca**: `packages/infrastructure/src/db/schema/calificacion.schema.ts`
(nuevo), `src/db/schema/index.ts`, `src/db/client.ts`, `src/db/seed/seed.ts`,
`src/repositories/calificacion.repository.ts` (nuevo),
`src/repositories/index.ts`, `migrations/0002_calificacion.sql` + `meta/`,
`test/` (nuevo), `package.json` (`check-types` revisa `test/`), `README.md`;
`packages/domain/src/{entities,dtos,repositories}/calificacion.*` (nuevos) +
sus `index.ts`; `DataBase/dbDiagram.sql`.
