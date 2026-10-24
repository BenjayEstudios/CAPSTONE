import { mysqlTable, bigint, varchar, tinyint } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { direccion } from "./direccion.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table punto_retiro.
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
  activo: tinyint("activo").notNull().default(1)
});
