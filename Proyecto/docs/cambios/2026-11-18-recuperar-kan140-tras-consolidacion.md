# Recuperar lo de KAN-140 que perdió la consolidación

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-140

La consolidación del 24-oct en `0000_schema_inicial.sql` dejó fuera lo de
[KAN-140](2026-10-23-indices-restricciones-y-particiones.md) (ver
[la alineación de Aiven](2026-11-18-alinear-aiven-con-esquema-inicial.md)).
La nueva migración `0001_kan140_indices_restricciones_particiones.sql` lo
recupera encima de la `0000`:

- **CHECK `ck_orden_envio_destino`**: retiro exige punto de retiro sin
  dirección; despacho, dirección sin punto de retiro. Declarado en
  `orden-envio.schema.ts`.
- **FULLTEXT `ix_producto_nombre_fulltext`** sobre `producto.nombre`, a mano
  (drizzle-kit no lo genera).
- **`evento_analitico` particionada por mes** en `creado_en`, de
  `p_anterior` a `p202702` más `pmax`: se quitan sus 4 FKs (quedan como
  referencias lógicas que valida el backend), se borran los índices
  implícitos que dejan, y la PK pasa a `(id, creado_en)` en una sola
  sentencia (drizzle-kit la genera en dos y falla por el `AUTO_INCREMENT`;
  en Aiven, con `sql_require_primary_key = 1`, la tabla nunca puede quedar
  sin PK). `pnpm db:particiones` vuelve a tener qué mantener.

**Probado**: desde cero y sobre una base con la `0000` y el seed cargados
(el caso de Aiven), las dos con `sql_require_primary_key = 1`; los 2.002
eventos del seed se reparten solos en `p202609` y `p202610`. `db:generate`
no ve diferencias. Pasan los tests de `restricciones.test.ts`.

**Pendiente**: los 4 índices compuestos de analítica
([KAN-143](2026-10-23-consultas-de-analitica.md)) tampoco sobrevivieron a
la consolidación; su test de planes sigue fallando.

**Por qué**: el buscador necesita el FULLTEXT, la regla retiro/despacho
tiene que valerla la base, y la analítica crece sin límite.

**Toca**: `packages/infrastructure/migrations/0001_*.sql` +
`meta/0001_snapshot.json` + `meta/_journal.json`,
`src/db/schema/{producto,orden-envio,evento-analitico}.schema.ts`;
`DataBase/dbDiagram.sql` (número de migración en las notas);
`docs/arquitectura/MODELO-DE-DATOS.md`, `docs/desarrollo/OPERAR-LA-BASE.md`.
