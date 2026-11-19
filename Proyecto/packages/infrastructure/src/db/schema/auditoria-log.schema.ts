import { mysqlTable, bigint, varchar, mysqlEnum, json, varbinary, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table auditoria_log.
// SOLO INSERCION. entidad + entidad_id es referencia polimorfica: sin FK.
export const auditoriaLog = mysqlTable(
  "auditoria_log",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => usuario.id),
    entidad: varchar("entidad", { length: 60 }).notNull(),
    entidadId: bigint("entidad_id", { mode: "number" }).notNull(),
    accion: mysqlEnum("accion", ["crear", "editar", "eliminar", "aprobar", "suspender", "reembolsar"]).notNull(),
    datosAntes: json("datos_antes"),
    datosDespues: json("datos_despues"),
    ip: varbinary("ip", { length: 16 }),
    creadoEn: datetime("creado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [index("auditoria_log_entidad_idx").on(t.entidad), index("auditoria_log_creado_en_idx").on(t.creadoEn)]
);
