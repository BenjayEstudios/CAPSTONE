import { mysqlTable, bigint, smallint, int, varchar, datetime, mysqlEnum, index, uniqueIndex } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { producto } from "./producto.schema.js";
import { organizacion } from "./organizacion.schema.js";

// Una fila por producto x proveedor. Precio VIGENTE (sin versionado
// desde/hasta). El comparador lee precio_unitario directo usando el
// indice (producto_id, precio_unitario). Los cambios de precio/stock se
// registran en oferta_precio_historial.
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
    unidadesPorCaja: smallint("unidades_por_caja"),
    cajasDisponibles: int("cajas_disponibles", { unsigned: true }),
    cajasIniciales: int("cajas_iniciales", { unsigned: true }),
    minimoCompra: smallint("minimo_compra"),
    plazoHoras: smallint("plazo_horas"),
    modalidadEntrega: mysqlEnum("modalidad_entrega", ["despacho", "retiro", "ambos"]).notNull(),
    notasCliente: varchar("notas_cliente", { length: 240 }),
    estado: mysqlEnum("estado", ["borrador", "publicada", "pausada"]).notNull().default("borrador"),
    actualizadaEn: datetime("actualizada_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    uniqueIndex("ux_oferta_producto_proveedor").on(table.productoId, table.proveedorId),
    index("ix_oferta_comparador").on(table.productoId, table.precioUnitario),
    index("ix_oferta_estado").on(table.estado)
  ]
);
