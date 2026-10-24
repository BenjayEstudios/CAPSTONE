import { mysqlTable, bigint, int, smallint, decimal, mysqlEnum, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { orden } from "./orden.schema.js";
import { organizacion } from "./organizacion.schema.js";
import { puntoRetiro } from "./punto-retiro.schema.js";
import { direccion } from "./direccion.schema.js";
import { liquidacion } from "./liquidacion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table orden_envio. Incluye
// liquidacion_detalle fusionado (liquidacion_id + montos liquidados).
// punto_retiro_id si modalidad = retiro; direccion_entrega_id si despacho;
// nunca ambos (validado en aplicacion). proveedor_id debe ser tipo proveedor.
export const ordenEnvio = mysqlTable(
  "orden_envio",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    ordenId: bigint("orden_id", { mode: "number" })
      .notNull()
      .references(() => orden.id),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    modalidad: mysqlEnum("modalidad", ["despacho", "retiro"]).notNull(),
    puntoRetiroId: bigint("punto_retiro_id", { mode: "number" }).references(() => puntoRetiro.id),
    direccionEntregaId: bigint("direccion_entrega_id", { mode: "number" }).references(() => direccion.id),
    plazoHoras: smallint("plazo_horas"),
    costoDespacho: int("costo_despacho", { unsigned: true }),
    subtotal: int("subtotal", { unsigned: true }).notNull(),
    comisionPct: decimal("comision_pct", { precision: 5, scale: 2 }).notNull(),
    comisionMonto: int("comision_monto", { unsigned: true }).notNull(),
    estado: mysqlEnum("estado", [
      "por_despachar",
      "en_preparacion",
      "listo_retiro",
      "despachado",
      "entregado",
      "cancelado"
    ])
      .notNull()
      .default("por_despachar"),
    liquidacionId: bigint("liquidacion_id", { mode: "number" }).references(() => liquidacion.id),
    montoBrutoLiquidado: int("monto_bruto_liquidado", { unsigned: true }),
    comisionLiquidada: int("comision_liquidada", { unsigned: true }),
    montoNetoLiquidado: int("monto_neto_liquidado", { unsigned: true }),
    actualizadoEn: datetime("actualizado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [index("orden_envio_proveedor_estado_idx").on(t.proveedorId, t.estado)]
);
