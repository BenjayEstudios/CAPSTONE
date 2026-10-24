import { mysqlTable, bigint, json, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// Carro unico del cliente; mezcla ofertas de proveedores distintos.
// FUSION: incluye lo que antes era carro_linea, ahora como columna JSON
// "items" (array [{oferta_id, cantidad, precio_visto}]; unicidad por
// oferta_id validada en aplicacion).
export const carro = mysqlTable(
  "carro",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    usuarioId: bigint("usuario_id", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    estado: mysqlEnum("estado", ["abierto", "convertido", "abandonado"]).notNull().default("abierto"),
    items: json("items").notNull(),
    actualizadoEn: datetime("actualizado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ix_carro_estado").on(table.estado)]
);
