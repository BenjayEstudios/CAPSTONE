import {
  mysqlTable,
  bigint,
  int,
  smallint,
  varchar,
  mysqlEnum,
  datetime,
  index,
  uniqueIndex
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { producto } from "./producto.schema.js";
import { organizacion } from "./organizacion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table oferta. proveedor_id debe
// ser una organizacion con tipo = proveedor (validado en aplicacion).
// Notas "unsigned" del DBML -> smallint({ unsigned: true }).
export const oferta = mysqlTable(
  "oferta",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    productoId: bigint("producto_id", { mode: "number" })
      .notNull()
      .references(() => producto.id),
    proveedorId: bigint("proveedor_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    precioUnitario: int("precio_unitario", { unsigned: true }).notNull(),
    unidadesPorCaja: smallint("unidades_por_caja", { unsigned: true }),
    cajasDisponibles: int("cajas_disponibles", { unsigned: true }),
    cajasIniciales: int("cajas_iniciales", { unsigned: true }),
    minimoCompra: smallint("minimo_compra", { unsigned: true }),
    plazoHoras: smallint("plazo_horas"),
    modalidadEntrega: mysqlEnum("modalidad_entrega", ["despacho", "retiro", "ambos"]).notNull(),
    notasCliente: varchar("notas_cliente", { length: 240 }),
    estado: mysqlEnum("estado", ["borrador", "publicada", "pausada"]).notNull().default("borrador"),
    actualizadaEn: datetime("actualizada_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [
    uniqueIndex("oferta_producto_proveedor_uq").on(t.productoId, t.proveedorId),
    index("ix_oferta_comparador").on(t.productoId, t.precioUnitario),
    index("oferta_estado_idx").on(t.estado)
  ]
);
