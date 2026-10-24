import { mysqlTable, bigint, varchar, int, boolean, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { usuario } from "./usuario.schema.js";
import { organizacion } from "./organizacion.schema.js";
import { direccion } from "./direccion.schema.js";

// Lo que el cliente paga una sola vez. codigo es el folio visible
// (CM-90412). FUSION: incluye lo que antes era la tabla pago (medio_pago,
// estado_pago, referencia_pasarela, pagado_en), alineado con la regla "una
// orden = un pago del cliente".
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
    requiereFactura: boolean("requiere_factura").notNull().default(false),
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
    estadoPago: mysqlEnum("estado_pago", ["autorizado", "pagado", "fallido", "reembolsado"]).notNull().default("autorizado"),
    referenciaPasarela: varchar("referencia_pasarela", { length: 80 }),
    creadaEn: datetime("creada_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`),
    pagadoEn: datetime("pagado_en", { mode: "date" })
  },
  (table) => [index("ix_orden_estado").on(table.estado), index("ix_orden_estado_pago").on(table.estadoPago)]
);
