import { mysqlTable, bigint, varchar, json, varbinary, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";

// SOLO INSERCION. Aprobaciones de proveedor, ediciones de ficha, reembolsos,
// cambios de permisos. entidad + entidad_id es una referencia polimorfica:
// no lleva FK declarada, se resuelve en aplicacion segun el valor de "entidad".
export const auditoriaLog = mysqlTable(
  "auditoria_log",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => usuario.id),
    // nombre de la tabla afectada (referencia polimorfica)
    entidad: varchar("entidad", { length: 60 }).notNull(),
    entidadId: bigint("entidad_id", { mode: "number" }).notNull(),
    accion: mysqlEnum("accion", ["crear", "editar", "eliminar", "aprobar", "suspender", "reembolsar"]).notNull(),
    datosAntes: json("datos_antes"),
    datosDespues: json("datos_despues"),
    ip: varbinary("ip", { length: 16 }),
    creadoEn: datetime("creado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ix_auditoria_log_entidad").on(table.entidad), index("ix_auditoria_log_creado_en").on(table.creadoEn)]
);
