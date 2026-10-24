import {
  mysqlTable,
  bigint,
  smallint,
  varchar,
  decimal,
  mysqlEnum,
  text,
  int,
  json,
  datetime,
  index
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { categoria } from "./categoria.schema.js";
import { usuario } from "./usuario.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table producto.
// imagenes: JSON [{url, texto_alt, orden, es_principal, subida_por, subida_en}].
// El indice FULLTEXT ix_producto_nombre_fulltext sobre nombre NO se puede
// declarar en Drizzle; se agrega a mano al final de la migracion (ALTER TABLE).
export const producto = mysqlTable(
  "producto",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    categoriaId: smallint("categoria_id")
      .notNull()
      .references(() => categoria.id),
    sku: varchar("sku", { length: 24 }).notNull().unique(),
    ean: varchar("ean", { length: 14 }).unique(),
    nombre: varchar("nombre", { length: 180 }).notNull(),
    marca: varchar("marca", { length: 80 }),
    formato: varchar("formato", { length: 80 }),
    contenido: decimal("contenido", { precision: 10, scale: 3 }),
    unidad: mysqlEnum("unidad", ["kg", "L", "unidad"]).notNull(),
    descripcion: text("descripcion"),
    precioReferencia: int("precio_referencia", { unsigned: true }),
    topeSobreReferenciaPct: smallint("tope_sobre_referencia_pct"),
    imagenes: json("imagenes"),
    estado: mysqlEnum("estado", ["borrador", "publicado", "archivado"]).notNull().default("borrador"),
    creadoPor: bigint("creado_por", { mode: "number" }).references(() => usuario.id),
    creadoEn: datetime("creado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [index("producto_estado_idx").on(t.estado)]
);
