import { mysqlTable, bigint, varchar, int } from "drizzle-orm/mysql-core";
import { ordenEnvio } from "./orden-envio.schema.js";
import { oferta } from "./oferta.schema.js";
import { producto } from "./producto.schema.js";

// Cuelga del ENVIO, no de la orden. Congela nombre_producto, formato y
// precio_unitario al momento de la compra, para que editar la oferta
// despues no altere ordenes ya emitidas. FK conceptualmente ON DELETE
// CASCADE desde orden_envio (agregar en la migracion si se necesita).
export const ordenLinea = mysqlTable("orden_linea", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  ordenEnvioId: bigint("orden_envio_id", { mode: "number" })
    .notNull()
    .references(() => ordenEnvio.id),
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
