import { mysqlTable, bigint, smallint, int, decimal, datetime, mysqlEnum, index, check } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { orden } from "./orden.schema.js";
import { organizacion } from "./organizacion.schema.js";
import { puntoRetiro } from "./punto-retiro.schema.js";
import { direccion } from "./direccion.schema.js";
import { liquidacion } from "./liquidacion.schema.js";

// El tramo de cada proveedor dentro de una orden; es lo unico que el
// proveedor ve en su panel. punto_retiro_id se exige si modalidad = retiro;
// direccion_entrega_id si modalidad = despacho; nunca ambos (CHECK
// ck_orden_envio_destino, KAN-140). FUSION: incluye lo que antes era
// liquidacion_detalle.
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
    // Se completa cuando este envio entra en un corte semanal.
    liquidacionId: bigint("liquidacion_id", { mode: "number" }).references(() => liquidacion.id),
    montoBrutoLiquidado: int("monto_bruto_liquidado", { unsigned: true }),
    comisionLiquidada: int("comision_liquidada", { unsigned: true }),
    montoNetoLiquidado: int("monto_neto_liquidado", { unsigned: true }),
    actualizadoEn: datetime("actualizado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("ix_orden_envio_proveedor_estado").on(table.proveedorId, table.estado),
    check(
      "ck_orden_envio_destino",
      sql`(${table.modalidad} = 'retiro' AND ${table.puntoRetiroId} IS NOT NULL AND ${table.direccionEntregaId} IS NULL)
        OR (${table.modalidad} = 'despacho' AND ${table.direccionEntregaId} IS NOT NULL AND ${table.puntoRetiroId} IS NULL)`
    )
  ]
);
