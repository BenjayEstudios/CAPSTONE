import { mysqlTable, smallint, varchar, index } from "drizzle-orm/mysql-core";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table comuna (incluye region).
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
  (t) => [index("comuna_nombre_idx").on(t.nombre), index("comuna_region_codigo_idx").on(t.regionCodigo)]
);
