import { mysqlTable, smallint, varchar, index } from "drizzle-orm/mysql-core";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table comuna.
// FUSION: incluye lo que antes era la tabla region (catalogo chico y
// estatico de 16 regiones de Chile, sin necesidad de tabla propia).
export const comuna = mysqlTable(
  "comuna",
  {
    id: smallint("id").autoincrement().primaryKey(),
    codigo: varchar("codigo", { length: 8 }).notNull().unique(),
    nombre: varchar("nombre", { length: 80 }).notNull(),
    regionCodigo: varchar("region_codigo", { length: 8 }).notNull(),
    regionNombre: varchar("region_nombre", { length: 80 }).notNull(),
    regionOrden: smallint("region_orden")
  },
  (table) => [index("ix_comuna_nombre").on(table.nombre), index("ix_comuna_region_codigo").on(table.regionCodigo)]
);
