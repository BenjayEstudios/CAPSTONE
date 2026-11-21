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
    // Secreto TOTP cifrado (AES-256-GCM, ver apps/backend/src/lib/mfa.ts). NULL = sin enrolar.
    mfaSecreto: varchar("mfa_secreto", { length: 255 }),
    ultimoAcceso: datetime("ultimo_acceso"),
    estado: mysqlEnum("estado", ["activo", "invitado", "suspendido"]).notNull().default("invitado")
  },
  // usuario_nombre_idx: orden por nombre y busqueda por prefijo. El FULLTEXT usuario_busqueda_ft
  // (nombre, email) lo usa la busqueda del listado; Drizzle no lo modela, vive en la migracion 0003.
  (t) => [index("usuario_estado_idx").on(t.estado), index("usuario_nombre_idx").on(t.nombre)]
);
