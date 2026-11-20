import { mysqlTable, bigint, tinyint, varchar, datetime, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { ordenEnvio } from "./orden-envio.schema.js";
import { usuario } from "./usuario.schema.js";

// Calificacion del cliente a un proveedor por un envio ENTREGADO: una por
// orden_envio (unique), puntaje 1-5 (CHECK). Que el envio este entregado y
// que quien califica pertenezca a la organizacion compradora no se puede
// expresar como CHECK (cruza tablas): lo garantiza el INSERT ... SELECT de
// DrizzleCalificacionRepository.registrar. El promedio por proveedor NO se
// guarda en organizacion: se calcula con una consulta (ver
// DrizzleCalificacionRepository.resumenPorProveedor y dbDiagram.sql).
export const calificacion = mysqlTable(
  "calificacion",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    ordenEnvioId: bigint("orden_envio_id", { mode: "number" })
      .notNull()
      .unique("ux_calificacion_orden_envio")
      .references(() => ordenEnvio.id),
    // Quien califica: usuario de la organizacion que hizo la orden.
    usuarioId: bigint("usuario_id", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    puntaje: tinyint("puntaje", { unsigned: true }).notNull(),
    comentario: varchar("comentario", { length: 500 }),
    creadaEn: datetime("creada_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [check("ck_calificacion_puntaje", sql`${table.puntaje} BETWEEN 1 AND 5`)]
);
