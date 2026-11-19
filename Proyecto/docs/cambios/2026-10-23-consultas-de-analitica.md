# Consultas de analítica para los paneles

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-143

Nuevo puerto `AnaliticaRepository` (`packages/domain`) e implementación
`DrizzleAnaliticaRepository` (`packages/infrastructure`):

| Función | Panel |
|---|---|
| `ventasPorSemana` — envíos, ventas, despacho, comisión y neto por semana, sin huecos | proveedor |
| `ventasPorProducto` — unidades y monto por producto | proveedor |
| `embudoPorProducto` — vistas → clicks → conversiones, con tasas | proveedor |
| `kpisPlataforma` — órdenes, GMV, ticket, comisiones, proveedores/clientes activos, conversión, búsquedas | admin |
| `terminosSinResultados` — huecos del catálogo | admin |

## Planes de ejecución

Con el seed (11 órdenes) el optimizador recorre tablas enteras y el plan no
dice nada, así que se midió con `EXPLAIN ANALYZE` en un schema desechable con
40 mil órdenes, 80 mil envíos y 800 mil eventos
(`packages/infrastructure/docs/volumen.sql`). Resultado, migración
`0005_indices_analitica.sql` con 4 índices compuestos (mismos nombres):

- `evento_analitico (producto_id, tipo_evento, creado_en)`: las vistas del
  embudo se cuentan solo con el índice. El embudo de un proveedor con 17
  ofertas pasó de ~360 ms a ~50 ms.
- `evento_analitico (oferta_id, creado_en, convirtio)`: clicks y
  conversiones también solo con el índice.
- `evento_analitico (tipo_evento, creado_en)` y `orden (estado_pago,
  creada_en)`: rango real de fechas en vez de recorrer todo el historial.

Las ventas del proveedor entran por `ix_orden_envio_proveedor_estado` y no
se tocaron (8-13 ms). Detalle de cada plan en
`packages/infrastructure/docs/CONSULTAS_ANALITICA.md`.

## Seed

~2.000 eventos sintéticos (vistas, clicks, búsquedas con y sin resultados)
del 1-sep al 22-oct de 2026, con semilla fija: el seed sigue siendo
determinista.

## Ojo: fechas en `` sql`...` ``

Drizzle guarda los `datetime` en UTC, pero un `Date` pasado como parámetro en
`` sql`...` `` lo formatea mysql2 en hora local (en Chile, 3-4 h corrido). El
repositorio pasa los límites del rango como texto UTC; hay un test que lo
detecta. Quien escriba SQL a mano en otros repositorios tiene que hacer lo
mismo.

**Por qué**: los paneles de proveedor y admin necesitan estas métricas, y
el criterio del ticket pide los planes revisados y documentados.

**Verificado**: `test/analitica.repository.test.ts` (montos contra las
órdenes del seed calculadas a mano, embudo y KPIs contra conteos directos,
UTC, y con `EXPLAIN` el uso de los índices y el pruning) contra el MySQL
local con el seed.

**Toca**: `packages/domain/src/{entities,repositories}/analitica.*` (nuevos)
+ `index.ts`; `packages/infrastructure/src/repositories/analitica.repository.ts`
(nuevo), `src/repositories/index.ts`,
`src/db/schema/{evento-analitico,orden}.schema.ts`, `src/db/seed/seed.ts`,
`migrations/0005_indices_analitica.sql` + `meta/`,
`test/analitica.repository.test.ts` (nuevo), `docs/` (nuevo:
`CONSULTAS_ANALITICA.md`, `volumen.sql`), `README.md`.
