import { mysqlTable, bigint, varchar, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// La cola del panel de administracion: altas de proveedor, fichas
// duplicadas, precio fuera de rango, reembolsos.
export const moderacionCaso = mysqlTable(
  "moderacion_caso",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipo: mysqlEnum("tipo", ["alta_proveedor", "ficha_duplicada", "precio_fuera_rango", "reembolso"]).notNull(),
    // referencia polimorfica, igual que auditoria_log
    entidad: varchar("entidad", { length: 60 }).notNull(),
    entidadId: bigint("entidad_id", { mode: "number" }).notNull(),
    detalle: varchar("detalle", { length: 300 }),
    estado: mysqlEnum("estado", ["abierto", "resuelto", "descartado"]).notNull().default("abierto"),
    asignadoA: bigint("asignado_a", { mode: "number" }).references(() => usuario.id),
    creadoEn: datetime("creado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    resueltoEn: datetime("resuelto_en", { mode: "date" })
  },
  (table) => [index("ix_moderacion_caso_tipo").on(table.tipo), index("ix_moderacion_caso_estado").on(table.estado)]
);
