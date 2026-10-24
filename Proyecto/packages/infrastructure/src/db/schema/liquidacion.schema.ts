import { mysqlTable, bigint, date, int, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";

// Corte semanal por proveedor (lo entregado y confirmado la semana
// anterior; se liquida los martes). El detalle por envio no vive en una
// tabla aparte: se obtiene con orden_envio WHERE liquidacion_id = liquidacion.id.
export const liquidacion = mysqlTable(
  "liquidacion",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    periodoDesde: date("periodo_desde").notNull(),
    periodoHasta: date("periodo_hasta").notNull(),
    montoBruto: int("monto_bruto", { unsigned: true }).notNull(),
    comision: int("comision", { unsigned: true }).notNull(),
    montoNeto: int("monto_neto", { unsigned: true }).notNull(),
    estado: mysqlEnum("estado", ["pendiente", "pagada"]).notNull().default("pendiente"),
    pagadaEn: datetime("pagada_en", { mode: "date" })
  },
  (table) => [index("ix_liquidacion_estado").on(table.estado)]
);
