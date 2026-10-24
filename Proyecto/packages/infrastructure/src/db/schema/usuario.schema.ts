import { mysqlTable, bigint, smallint, varchar, char, mysqlEnum, datetime, index } from "drizzle-orm/mysql-core";
import { organizacion } from "./organizacion.schema.js";
import { rol } from "./rol.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table usuario.
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
    ultimoAcceso: datetime("ultimo_acceso"),
    estado: mysqlEnum("estado", ["activo", "invitado", "suspendido"]).notNull().default("invitado")
  },
  (t) => [index("usuario_estado_idx").on(t.estado)]
);
