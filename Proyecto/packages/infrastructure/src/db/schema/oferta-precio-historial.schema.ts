import { mysqlTable, bigint, int, varchar, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { oferta } from "./oferta.schema.js";
import { usuario } from "./usuario.schema.js";

// SOLO INSERCION. Bitacora de cambios de precio y stock de una oferta.
export const ofertaPrecioHistorial = mysqlTable(
  "oferta_precio_historial",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    ofertaId: bigint("oferta_id", { mode: "number" })
      .notNull()
      .references(() => oferta.id),
    precioAnterior: int("precio_anterior", { unsigned: true }),
    precioNuevo: int("precio_nuevo", { unsigned: true }),
    cajasAnteriores: int("cajas_anteriores", { unsigned: true }),
    cajasNuevas: int("cajas_nuevas", { unsigned: true }),
    motivo: varchar("motivo", { length: 120 }),
    cambiadoPor: bigint("cambiado_por", { mode: "number" }).references(() => usuario.id),
    cambiadoEn: datetime("cambiado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ix_oferta_precio_historial_cambiado_en").on(table.cambiadoEn)]
);
