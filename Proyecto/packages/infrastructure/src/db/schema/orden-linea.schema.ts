import { mysqlTable, bigint, int, varchar } from "drizzle-orm/mysql-core";
import { ordenEnvio } from "./orden-envio.schema.js";
import { oferta } from "./oferta.schema.js";
import { producto } from "./producto.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table orden_linea. Cuelga del
// ENVIO; congela nombre_producto, formato y precio_unitario. FK ON DELETE
// CASCADE (la Note del DBML lo indica).
export const ordenLinea = mysqlTable("orden_linea", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  ordenEnvioId: bigint("orden_envio_id", { mode: "number" })
    .notNull()
    .references(() => ordenEnvio.id, { onDelete: "cascade" }),
  ofertaId: bigint("oferta_id", { mode: "number" })
    .notNull()
    .references(() => oferta.id),
  productoId: bigint("producto_id", { mode: "number" })
    .notNull()
    .references(() => producto.id),
  nombreProducto: varchar("nombre_producto", { length: 180 }).notNull(),
  formato: varchar("formato", { length: 80 }),
  precioUnitario: int("precio_unitario", { unsigned: true }).notNull(),
  cantidad: int("cantidad", { unsigned: true }).notNull(),
  totalLinea: int("total_linea", { unsigned: true }).notNull()
});
