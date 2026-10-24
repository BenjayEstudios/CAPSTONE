import { mysqlTable, bigint, varchar, mysqlEnum, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table moderacion_caso.
// entidad + entidad_id es una referencia polimorfica: sin FK, se resuelve en app.
export const moderacionCaso = mysqlTable(
  "moderacion_caso",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipo: mysqlEnum("tipo", ["alta_proveedor", "ficha_duplicada", "precio_fuera_rango", "reembolso"]).notNull(),
    entidad: varchar("entidad", { length: 60 }).notNull(),
    entidadId: bigint("entidad_id", { mode: "number" }).notNull(),
    detalle: varchar("detalle", { length: 300 }),
    estado: mysqlEnum("estado", ["abierto", "resuelto", "descartado"]).notNull().default("abierto"),
    asignadoA: bigint("asignado_a", { mode: "number" }).references(() => usuario.id),
    creadoEn: datetime("creado_en").notNull().default(sql`CURRENT_TIMESTAMP`),
    resueltoEn: datetime("resuelto_en")
  },
  (t) => [index("moderacion_caso_tipo_idx").on(t.tipo), index("moderacion_caso_estado_idx").on(t.estado)]
);
