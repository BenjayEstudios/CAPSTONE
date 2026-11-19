import { mysqlTable, bigint, mysqlEnum, json, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table carro.
// items: array [{oferta_id, cantidad, precio_visto}]; unicidad por oferta_id validada en aplicacion.
export const carro = mysqlTable(
  "carro",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    usuarioId: bigint("usuario_id", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    estado: mysqlEnum("estado", ["abierto", "convertido", "abandonado"]).notNull().default("abierto"),
    items: json("items").notNull(),
    actualizadoEn: datetime("actualizado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [index("carro_estado_idx").on(t.estado)]
);
