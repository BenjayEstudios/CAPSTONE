import { mysqlTable, bigint, smallint, varchar, decimal } from "drizzle-orm/mysql-core";
import { comuna } from "./comuna.schema.js";

// Direccion generica reutilizable: facturacion, entrega y bodega.
export const direccion = mysqlTable("direccion", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  comunaId: smallint("comuna_id")
    .notNull()
    .references(() => comuna.id),
  calle: varchar("calle", { length: 160 }).notNull(),
  numero: varchar("numero", { length: 20 }),
  complemento: varchar("complemento", { length: 80 }),
  referencia: varchar("referencia", { length: 240 }),
  latitud: decimal("latitud", { precision: 9, scale: 6 }),
  longitud: decimal("longitud", { precision: 9, scale: 6 })
});
