import { mysqlTable, bigint, varchar, boolean } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { direccion } from "./direccion.schema.js";

// Bodega o local donde el cliente retira; solo aplica si
// organizacion.ofrece_retiro = 1. proveedor_id debe ser una organizacion
// con tipo = proveedor (se valida en aplicacion, no hay CHECK por valor).
export const puntoRetiro = mysqlTable("punto_retiro", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  proveedorId: bigint("proveedor_id", { mode: "number" })
    .notNull()
    .references(() => organizacion.id),
  direccionId: bigint("direccion_id", { mode: "number" })
    .notNull()
    .references(() => direccion.id),
  nombre: varchar("nombre", { length: 120 }).notNull(),
  horario: varchar("horario", { length: 180 }),
  activo: boolean("activo").notNull().default(true)
});
