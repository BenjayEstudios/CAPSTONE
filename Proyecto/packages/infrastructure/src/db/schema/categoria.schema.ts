import { mysqlTable, smallint, varchar, mysqlEnum } from "drizzle-orm/mysql-core";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table categoria. padre_id no
// lleva referencia declarada aca a proposito (self-reference de arbol de
// 2 niveles); se valida en el caso de uso si hace falta.
export const categoria = mysqlTable("categoria", {
  id: smallint("id").autoincrement().primaryKey(),
  padreId: smallint("padre_id"),
  nombre: varchar("nombre", { length: 80 }).notNull(),
  slug: varchar("slug", { length: 80 }).notNull().unique(),
  orden: smallint("orden"),
  estado: mysqlEnum("estado", ["activa", "oculta"]).notNull().default("activa")
});
