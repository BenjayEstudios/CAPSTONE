import { mysqlTable, bigint, int, mysqlEnum, date, datetime, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table liquidacion. Corte semanal
// por proveedor; el detalle es orden_envio WHERE liquidacion_id = liquidacion.id.
// proveedor_id debe ser una organizacion con tipo = proveedor (aplicacion).
export const liquidacion = mysqlTable(
  "liquidacion",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    periodoDesde: date("periodo_desde", { mode: "string" }).notNull(),
    periodoHasta: date("periodo_hasta", { mode: "string" }).notNull(),
    montoBruto: int("monto_bruto", { unsigned: true }).notNull(),
    comision: int("comision", { unsigned: true }).notNull(),
    montoNeto: int("monto_neto", { unsigned: true }).notNull(),
    estado: mysqlEnum("estado", ["pendiente", "pagada"]).notNull().default("pendiente"),
    pagadaEn: datetime("pagada_en")
  },
  (t) => [index("liquidacion_estado_idx").on(t.estado)]
);
