import { mysqlTable, bigint, smallint, varchar, int, uniqueIndex } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { comuna } from "./comuna.schema.js";

// Donde despacha el proveedor y a que costo; comuna_id NULL = toda la
// region (identificada por region_codigo).
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
  (table) => [
    uniqueIndex("ux_proveedor_cobertura_proveedor_region_comuna").on(
      table.proveedorId,
      table.regionCodigo,
      table.comunaId
    )
  ]
);
