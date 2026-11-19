import { mysqlTable, bigint, smallint, varchar, int, uniqueIndex } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { comuna } from "./comuna.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table proveedor_cobertura.
// comuna_id NULL = toda la region (region_codigo).
export const proveedorCobertura = mysqlTable(
  "proveedor_cobertura",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    comunaId: smallint("comuna_id").references(() => comuna.id),
    regionCodigo: varchar("region_codigo", { length: 8 }).notNull(),
    costoDespacho: int("costo_despacho", { unsigned: true }).notNull(),
    plazoHoras: smallint("plazo_horas")
  },
  (t) => [uniqueIndex("proveedor_cobertura_prov_region_comuna_uq").on(t.proveedorId, t.regionCodigo, t.comunaId)]
);
