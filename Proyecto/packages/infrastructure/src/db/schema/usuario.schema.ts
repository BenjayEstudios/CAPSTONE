import { mysqlTable, bigint, smallint, varchar, char, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { rol } from "./rol.schema.js";

// Cuenta de acceso: una organizacion, un rol. Referencia circular con rol
// (rol.permisos_actualizado_por -> usuario.id) resuelta via import circular
// + callback lazy en .references(), igual que en rol.schema.ts.
export const usuario = mysqlTable(
  "usuario",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    organizacionId: bigint("organizacion_id", { mode: "number" })
      .notNull()
      .references(() => organizacion.id),
    rolId: smallint("rol_id")
      .notNull()
      .references(() => rol.id),
    nombre: varchar("nombre", { length: 120 }).notNull(),
    email: varchar("email", { length: 160 }).notNull().unique(),
    rut: varchar("rut", { length: 12 }),
    telefono: varchar("telefono", { length: 24 }),
    hashClave: char("hash_clave", { length: 60 }).notNull(),
    mfaEstado: mysqlEnum("mfa_estado", ["activo", "pendiente", "opcional", "inactivo"]).notNull().default("inactivo"),
    ultimoAcceso: datetime("ultimo_acceso", { mode: "date" }),
    estado: mysqlEnum("estado", ["activo", "invitado", "suspendido"]).notNull().default("invitado")
  },
  (table) => [index("ix_usuario_estado").on(table.estado)]
);
