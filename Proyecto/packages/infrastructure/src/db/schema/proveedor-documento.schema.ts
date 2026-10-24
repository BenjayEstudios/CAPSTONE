import { mysqlTable, bigint, varchar, date, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { usuario } from "./usuario.schema.js";

// Carpeta tributaria, resolucion sanitaria, vigencia.
export const proveedorDocumento = mysqlTable(
  "proveedor_documento",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    tipo: mysqlEnum("tipo", ["carpeta_tributaria", "resolucion_sanitaria", "vigencia"]).notNull(),
    url: varchar("url", { length: 300 }).notNull(),
    venceEn: date("vence_en"),
    estado: mysqlEnum("estado", ["al_dia", "por_vencer", "vencido"]).notNull().default("al_dia"),
    revisadoPor: bigint("revisado_por", { mode: "number" }).references(() => usuario.id)
  },
  (table) => [index("ix_proveedor_documento_vence_en").on(table.venceEn)]
);
