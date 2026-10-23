import { mysqlTable, smallint, bigint, varchar, json, datetime, boolean, type AnyMySqlColumn } from "drizzle-orm/mysql-core";
import { usuario } from "./usuario.schema.js";

// FUSION: reemplaza las tablas permiso + rol_permiso. "permisos" guarda la
// matriz completa como JSON (ver nota en DataBase/dbDiagram.sql); se
// lee/escribe el objeto completo y se filtra en la aplicacion.
// Referencia circular con usuario (usuario.rol_id <-> rol.permisos_actualizado_por):
// se resuelve con el callback lazy de .references(), estandar en Drizzle.
export const rol = mysqlTable("rol", {
  id: smallint("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 40 }).notNull().unique(),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  descripcion: varchar("descripcion", { length: 240 }),
  esSistema: boolean("es_sistema").notNull().default(false),
  permisos: json("permisos").notNull(),
  permisosActualizadoPor: bigint("permisos_actualizado_por", { mode: "number" }).references(
    (): AnyMySqlColumn => usuario.id
  ),
  permisosActualizadoEn: datetime("permisos_actualizado_en", { mode: "date" })
});
