import { mysqlTable, bigint, int, varchar, tinyint, mysqlEnum, datetime, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";
import { organizacion } from "./organizacion.schema.js";
import { direccion } from "./direccion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table orden. Incluye el pago
// fusionado (medio_pago, estado_pago, referencia_pasarela, pagado_en).
// codigo es el folio visible (CM-90412).
export const orden = mysqlTable(
  "orden",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    codigo: varchar("codigo", { length: 16 }).notNull().unique(),
    usuarioId: bigint("usuario_id", { mode: "number" })
      .notNull()
      .references(() => usuario.id),
    organizacionId: bigint("organizacion_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    direccionEntregaId: bigint("direccion_entrega_id", { mode: "number" }).references(() => direccion.id),
    subtotal: int("subtotal", { unsigned: true }).notNull(),
    costoDespachoTotal: int("costo_despacho_total", { unsigned: true }).notNull(),
    comisionTotal: int("comision_total", { unsigned: true }).notNull(),
    total: int("total", { unsigned: true }).notNull(),
    requiereFactura: tinyint("requiere_factura").notNull().default(0),
    estado: mysqlEnum("estado", [
      "pendiente_pago",
      "pagada",
      "en_preparacion",
      "despachada",
      "entregada",
      "reembolsada"
    ])
      .notNull()
      .default("pendiente_pago"),
    medioPago: mysqlEnum("medio_pago", ["tarjeta", "transferencia", "linea_credito"]),
    estadoPago: mysqlEnum("estado_pago", ["autorizado", "pagado", "fallido", "reembolsado"])
      .notNull()
      .default("autorizado"),
    referenciaPasarela: varchar("referencia_pasarela", { length: 80 }),
    creadaEn: datetime("creada_en").notNull().default(sql`CURRENT_TIMESTAMP`),
    pagadoEn: datetime("pagado_en")
  },
  (t) => [index("orden_estado_idx").on(t.estado), index("orden_estado_pago_idx").on(t.estadoPago)]
);
