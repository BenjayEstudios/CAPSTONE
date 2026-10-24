# Modelo de datos

MySQL 8.4 con Drizzle ORM. La fuente de verdad del modelo es el DBML en
[`DataBase/dbDiagram.sql`](../../DataBase/dbDiagram.sql) (con su imagen en
`DataBase/DBdiagram.png`); el schema de Drizzle lo traduce 1:1.

## Tablas

22 tablas, un archivo por tabla en
`packages/infrastructure/src/db/schema/<tabla>.schema.ts`. Las principales:
`organizacion`, `usuario`, `rol`, `categoria`, `producto`, `oferta` (precio
por volumen/cantidad, no unitario), `carro`, `orden`, `orden_linea`,
`orden_envio`, `documento_tributario`, `liquidacion` (reparto simulado por
distribuidor), `proveedor_documento`, `proveedor_cobertura`,
`evento_analitico`, `auditoria_log`, `moderacion_caso`, `calificacion`.

Patrón: enums inline con `mysqlEnum`, FKs vía
`.references(() => otraTabla.columna)`. `categoria` es el ejemplo documentado.

La referencia circular `usuario.rol_id` ↔ `rol.permisos_actualizado_por` se
resuelve con un import circular entre `usuario.schema.ts` y `rol.schema.ts`
más la anotación `(): AnyMySqlColumn => ...` en el lado de `rol` (TypeScript
no infiere el tipo solo con el callback lazy en un ciclo).

## Migraciones

`pnpm --filter @cotizapp/infrastructure db:generate` genera el SQL a partir
del schema; `db:migrate` lo aplica contra `DATABASE_URL`.

| Migración | Qué hace | Ticket |
|---|---|---|
| `0000_blue_spirit.sql` | `categoria` | — |
| `0001_tense_next_avengers.sql` | Las 20 tablas restantes, con FKs e índices | KAN-139 |
| `0002_calificacion.sql` | `calificacion` | KAN-142 |
| `0003_indices_restricciones.sql` | FULLTEXT de `producto.nombre`, CHECK de `orden_envio` | KAN-140 |
| `0004_particion_evento_analitico.sql` | Particionado mensual de `evento_analitico` | KAN-140 |
| `0005_indices_analitica.sql` | 4 índices compuestos para las consultas de analítica | KAN-143 |

`0003` y `0004` llevan DDL escrito a mano que drizzle-kit no genera ni
conoce. Por eso **no se usa `drizzle-kit push`**: al comparar el schema
contra la base, borraría el FULLTEXT y las particiones. `generate` no los
toca.

## Índices y restricciones especiales (KAN-140)

- **Buscador**: `producto.nombre` tiene FULLTEXT
  (`ix_producto_nombre_fulltext`). La collation `utf8mb4_0900_ai_ci` lo hace
  insensible a tildes y mayúsculas. No hay stemming ("quesos" no encuentra
  "Queso"): el buscador debería usar `MATCH ... AGAINST('ques*' IN BOOLEAN MODE)`.
- **Destino del envío**: `CHECK ck_orden_envio_destino` en `orden_envio` —
  retiro exige `punto_retiro_id` sin dirección; despacho exige
  `direccion_entrega_id` sin punto de retiro.
- **Comparador**: `ix_oferta_comparador (producto_id, precio_unitario)`,
  verificado con EXPLAIN (ref por producto, orden por precio sin filesort).

## `evento_analitico` particionada

Una sola tabla para vistas de producto, clics a oferta y búsquedas
(reemplaza a tres tablas). Particionada por mes en `creado_en`
(`PARTITION BY RANGE COLUMNS`), una partición `pAAAAMM` por mes más `pmax`
(MAXVALUE) de resguardo para que un insert nunca falle.

InnoDB no admite FKs en tablas particionadas y exige la columna de partición
en toda PK/UNIQUE. Por eso:

- la PK es `(id, creado_en)`;
- `producto_id`, `oferta_id`, `usuario_id` y `comuna_id` son referencias
  lógicas **sin FK**: el backend valida que existan al registrar el evento.

Se acepta porque es telemetría de solo inserción y producto/oferta nunca se
borran (se archivan o pausan). A cambio, las consultas por rango de fechas
leen solo esas particiones (pruning, verificado con EXPLAIN) y la retención
es un `DROP PARTITION` en vez de un `DELETE` masivo.

Las particiones de los meses siguientes las crea `pnpm db:particiones` (ver
[../desarrollo/OPERAR-LA-BASE.md](../desarrollo/OPERAR-LA-BASE.md)).

## Calificaciones (KAN-142)

Una fila por `orden_envio` entregado (UNIQUE en `orden_envio_id`), puntaje
1-5 con `CHECK`, comentario opcional. Cuelga del envío y no de la orden porque
cada tramo es de un proveedor distinto.

El promedio y la cantidad por proveedor se **calculan con una consulta**
(`AVG`/`COUNT` agrupando por `orden_envio.proveedor_id`), no se guardan como
columnas en `organizacion` — motivo en
[decisiones cerradas](../decisiones/DECISIONES-CERRADAS.md).

Las reglas que cruzan tablas (envío entregado, usuario de la organización
compradora) no caben en un CHECK: las garantiza el `INSERT ... SELECT` de
`DrizzleCalificacionRepository.registrar`. Puerto en `packages/domain`
(`CalificacionRepository`), con `registrar`, `resumenPorProveedor` y
`listarPorProveedor`.

## Cliente de base de datos

`DbClient` acepta un `Pool` o una conexión única (los tests usan una
conexión dentro de una transacción). Para los `SELECT` escritos con
`` sql`...` `` hay un helper `consultar()`.

## Analítica de los paneles (KAN-143)

`DrizzleAnaliticaRepository` (puerto `AnaliticaRepository` en
`packages/domain`): `ventasPorSemana`, `ventasPorProducto` y
`embudoPorProducto` para el panel proveedor; `kpisPlataforma` y
`terminosSinResultados` para el admin. Reglas comunes:

- Rangos `[desde, hasta)` en UTC, semanas lunes-domingo UTC. Un `Date`
  pasado en `` sql`...` `` lo formatea mysql2 en hora local; el repositorio lo
  pasa como texto UTC, que es como Drizzle guarda los `datetime`.
- Venta = envío no cancelado de una orden con `estado_pago = 'pagado'`,
  fechado por `orden.creada_en`.
- Embudo: vistas de la ficha (compartida) → clicks y conversiones en la
  oferta de ese proveedor.

SQL escrito a mano y revisado con `EXPLAIN ANALYZE` sobre datos de volumen
(40 mil órdenes, 800 mil eventos). De ahí salieron los índices compuestos de
`0005`: `evento_analitico (producto_id, tipo_evento, creado_en)`,
`(oferta_id, creado_en, convirtio)`, `(tipo_evento, creado_en)` y
`orden (estado_pago, creada_en)`. Los planes, los tiempos antes/después y el
script para repetir la prueba están en
`packages/infrastructure/docs/CONSULTAS_ANALITICA.md`. Si se cambia una
consulta, hay que volver a revisar su plan.

## Tests de repositorios

`packages/infrastructure/test/`: integración contra el MySQL local **con el
seed cargado**. Cada test corre en una transacción que se revierte, así que
no ensucia datos. Se niegan a correr contra un host no local. En CI (sin
MySQL) se saltan; en local fallan diciendo por qué. `restricciones.test.ts`
cubre lo de KAN-140 y `analitica.repository.test.ts` lo de KAN-143 (montos
contra las órdenes del seed calculadas a mano, y con `EXPLAIN` que las
consultas usen los índices compuestos y poden particiones). `check-types` también revisa `test/`.
