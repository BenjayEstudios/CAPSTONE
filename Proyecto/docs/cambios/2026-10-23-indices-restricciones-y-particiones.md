# Índices, restricciones especiales y particiones

**Fecha:** 2026-10-23 · **Épica:** KAN-88 · **Ticket:** KAN-140

Lo que el DBML pedía y Drizzle no sabe expresar, escrito a mano en dos
migraciones.

## `0003_indices_restricciones.sql`

- **FULLTEXT en `producto.nombre`** (`ix_producto_nombre_fulltext`) para el
  buscador. Reemplaza al BTREE `ix_producto_nombre`, que era el placeholder
  del schema. La collation `utf8mb4_0900_ai_ci` lo hace insensible a tildes
  ("azucar" encuentra "Azúcar"). Sin stemming: el buscador tendrá que usar
  `MATCH ... AGAINST('ques*' IN BOOLEAN MODE)`.
- **`CHECK ck_orden_envio_destino`** en `orden_envio`: retiro exige punto de
  retiro sin dirección, despacho exige dirección sin punto de retiro. El DBML
  decía "CHECK o validación en aplicación"; se eligió CHECK para que lo
  garantice la base.
- `ix_oferta_comparador` verificado con EXPLAIN: ref por producto y orden por
  precio sin filesort.

## `0004_particion_evento_analitico.sql`

`evento_analitico` pasa a estar particionada por mes en `creado_en`, con
`p_anterior`, `p202609`…`p202612` y `pmax` de resguardo.

El precio de particionar en InnoDB: no hay FKs en tablas particionadas y la
columna de partición tiene que estar en toda PK/UNIQUE. La migración:

1. borra las 4 FKs (`producto_id`, `oferta_id`, `usuario_id`, `comuna_id`
   quedan como referencias lógicas que valida el backend);
2. borra a mano los índices implícitos que MySQL deja al borrar esas FKs y
   que drizzle-kit no conoce;
3. cambia la PK a `(id, creado_en)` en **una** sentencia — drizzle-kit la
   genera en dos y `DROP PRIMARY KEY` solo falla (1075) porque `id` es
   `AUTO_INCREMENT`;
4. declara las particiones.

Nuevo comando `pnpm db:particiones` (`src/db/particiones/`): parte `pmax`
para que existan el mes actual y los 3 siguientes. Idempotente, no borra
datos. Se corre una vez al mes; si nadie lo corre no se pierde nada, solo se
deja de ganar pruning. Ver
[../desarrollo/OPERAR-LA-BASE.md](../desarrollo/OPERAR-LA-BASE.md).

## Consecuencia: no usar `drizzle-kit push`

Como hay DDL que drizzle-kit no ve, `push` lo borraría al comparar el schema
contra la base. `generate` + `migrate` no lo tocan.

**Por qué**: el buscador y el comparador del catálogo necesitan esos índices,
la regla retiro/despacho tiene que valer aunque un caso de uso se equivoque,
y la analítica crece sin límite: con particiones las consultas por rango leen
solo los meses pedidos y la retención es un `DROP PARTITION`.

**Verificado**: `test/restricciones.test.ts` y `test/particiones.test.ts`
contra el MySQL local con el seed.

**Toca**: `packages/infrastructure/migrations/0003_*.sql`, `0004_*.sql` +
`meta/`, `src/db/schema/{producto,orden-envio,evento-analitico}.schema.ts`,
`src/db/particiones/` (nuevo), `test/{restricciones,particiones}.test.ts`
(nuevos), `package.json` (script `db:particiones`), `README.md`;
`DataBase/dbDiagram.sql` (notas de `producto`, `oferta`, `orden_envio`,
`evento_analitico`).
