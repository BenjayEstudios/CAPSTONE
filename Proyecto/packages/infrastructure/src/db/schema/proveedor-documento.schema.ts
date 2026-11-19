import { mysqlTable, bigint, varchar, mysqlEnum, date, datetime, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { usuario } from "./usuario.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table proveedor_documento.
// "estado" es VIGENCIA (al_dia | por_vencer | vencido); la REVISION manual del
// admin vive en revision_estado / revisado_por / revisado_en / motivo_rechazo.
export const proveedorDocumento = mysqlTable(
  "proveedor_documento",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    tipo: mysqlEnum("tipo", ["carpeta_tributaria", "resolucion_sanitaria", "vigencia"]).notNull(),
    url: varchar("url", { length: 300 }).notNull(),
    venceEn: date("vence_en", { mode: "string" }),
    estado: mysqlEnum("estado", ["al_dia", "por_vencer", "vencido"]).notNull().default("al_dia"),
    revisionEstado: mysqlEnum("revision_estado", ["pendiente", "aprobado", "rechazado"]).notNull().default("pendiente"),
    revisadoPor: bigint("revisado_por", { mode: "number" }).references(() => usuario.id),
    revisadoEn: datetime("revisado_en"),
    motivoRechazo: varchar("motivo_rechazo", { length: 240 })
  },
  (t) => [index("proveedor_documento_vence_en_idx").on(t.venceEn)]
);
