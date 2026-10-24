import { mysqlTable, smallint, varchar, tinyint, json, bigint, datetime } from "drizzle-orm/mysql-core";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table rol. permisos es un objeto
// { "codigo_permiso": "ninguno|parcial|total" } (catalogo validado en app).
// permisos_actualizado_por no lleva referencia declarada aca a proposito
// (rol <-> usuario es circular: usuario.rol_id -> rol.id); mismo criterio que
// categoria.padreId, la integridad se valida en el caso de uso.
export const rol = mysqlTable("rol", {
  id: smallint("id").autoincrement().primaryKey(),
  codigo: varchar("codigo", { length: 40 }).notNull().unique(),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  descripcion: varchar("descripcion", { length: 240 }),
  esSistema: tinyint("es_sistema").notNull().default(0),
  permisos: json("permisos").notNull(),
  permisosActualizadoPor: bigint("permisos_actualizado_por", { mode: "number" }),
  permisosActualizadoEn: datetime("permisos_actualizado_en")
});
