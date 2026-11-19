# Aiven y la base local alineadas con el esquema inicial

**Fecha:** 2026-11-18 · **Épica:** KAN-88 · **Ticket:** KAN-139

La base compartida de Aiven (`defaultdb`) y el MySQL local de desarrollo se
recrearon desde cero con la migración única `0000_schema_inicial.sql` y el
seed actual.

## Qué se encontró

- **Aiven** tenía registradas las dos migraciones viejas (`0000_blue_spirit`
  y `0001`, del 22-oct), que la consolidación del 24-oct reemplazó por
  `0000_schema_inicial`. Respecto de esa migración:
  - faltaba la tabla `calificacion` completa (CHECK, índice único y FKs);
  - faltaban `revision_estado`, `revisado_en` y `motivo_rechazo` en
    `proveedor_documento`;
  - sobraba la FK `rol_permisos_actualizado_por_usuario_id_fk`;
  - 9 columnas tenían otro tipo: booleanos `tinyint(1)` en vez de `tinyint`,
    y `oferta.minimo_compra`, `oferta.unidades_por_caja` y
    `evento_analitico.resultados` sin `unsigned`;
  - unos 30 índices tenían nombres de la convención vieja (`ix_*`/`ux_*`).
- **`db:migrate` directo contra Aiven falla**: ve `0000_schema_inicial` como
  pendiente e intenta crear tablas que ya existen
  (`ERROR 1050 Table 'categoria' already exists`). `drizzle-kit` no muestra
  el mensaje: solo termina con código 1.
- **Los datos de Aiven eran solo del seed del 23-oct** (2 órdenes, 0
  calificaciones): conteos idénticos a ese seed, `AUTO_INCREMENT` = id
  máximo + 1 en todas las tablas (nada insertado y borrado), ninguna fecha
  posterior al 23-oct y ningún usuario con `ultimo_acceso`. Nadie del equipo
  había cargado datos.
- **El MySQL local** tenía registradas las 6 migraciones viejas (0000-0005).

## Qué se hizo

1. Respaldo completo de Aiven con `mysqldump` (fuera del repo, en
   `~/backups/cotizapp/` de Samuel), y otro justo antes de borrar.
2. Ensayo en un schema local descartable: se restauró el respaldo de Aiven,
   se activó `sql_require_primary_key = 1` para imitar Aiven y se corrió el
   procedimiento completo.
3. Local y Aiven: borrar todas las tablas (incluida `__drizzle_migrations`),
   `db:migrate` y `db:seed`.
4. Verificación en las dos bases: una sola fila en `__drizzle_migrations`
   con el sha256 de `0000_schema_inicial.sql`; columnas, índices, FKs y
   CHECKs idénticos a los de un schema armado solo con esa migración (360
   elementos); conteos del seed actual (11 órdenes, 21 envíos, 16
   calificaciones, 2.002 eventos); login de admin y `/auth/me` contra un
   backend local apuntando a cada base.

El procedimiento quedó en
[../desarrollo/OPERAR-LA-BASE.md](../desarrollo/OPERAR-LA-BASE.md#rearmar-aiven).

**Por qué recrear y no migrar**: no había una ruta de migración desde el
estado de Aiven a la migración consolidada (drizzle-kit la ve como una sola
migración pendiente que crea todo), y las diferencias eran muchas y
heterogéneas (tablas, columnas, tipos, nombres de índices, FKs). Como solo
había datos del seed, recrear era lo más simple y deja la base exactamente
igual a lo que produce el repo.

## Pendiente: lo que la consolidación dejó fuera

`0000_schema_inicial.sql` no trae parte de lo de
[KAN-140](2026-10-23-indices-restricciones-y-particiones.md) y
[KAN-143](2026-10-23-consultas-de-analitica.md): el FULLTEXT de
`producto.nombre`, el CHECK `ck_orden_envio_destino`, el particionado de
`evento_analitico` (que volvió a tener sus 4 FKs) y los índices compuestos de
analítica. Con las bases ya alineadas, 4 tests de
`packages/infrastructure` (`restricciones.test.ts` y el de planes de
`analitica.repository.test.ts`) fallan por eso, y `db:particiones` no tiene
particiones que mantener. Antes pasaban solo porque la base local tenía las
migraciones viejas. Recuperarlo es una migración nueva encima de la `0000`,
pendiente de decidir.

**Toca**: solo las bases (Aiven `defaultdb` y el MySQL local). En el repo:
esta entrada, `docs/cambios/README.md` y
`docs/desarrollo/OPERAR-LA-BASE.md`.
