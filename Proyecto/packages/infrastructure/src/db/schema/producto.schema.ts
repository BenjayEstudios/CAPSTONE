import { mysqlTable, bigint, smallint, varchar, text, decimal, int, json, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { categoria } from "./categoria.schema.js";
import { usuario } from "./usuario.schema.js";

// La ficha compartida. Solo la crea administracion. contenido + unidad
// permiten normalizar precio por kg/L entre formatos distintos de
// distintos proveedores. FUSION: incluye lo que antes era producto_imagen,
// ahora como columna JSON "imagenes".
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
    // array [{url, texto_alt, orden, es_principal, subida_por, subida_en}];
    // una sola con es_principal=true validado en aplicacion.
    imagenes: json("imagenes"),
    estado: mysqlEnum("estado", ["borrador", "publicado", "archivado"]).notNull().default("borrador"),
    creadoPor: bigint("creado_por", { mode: "number" }).references(() => usuario.id),
    creadoEn: datetime("creado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    // FULLTEXT ix_producto_nombre_fulltext (nombre) para la busqueda del
    // catalogo: Drizzle no soporta ese tipo de indice, se crea a mano en
    // migrations/0003_indices_restricciones.sql (KAN-140). drizzle-kit no lo
    // ve, asi que generate no lo toca; NO usar drizzle-kit push, que lo
    // borraria al comparar contra la base.
    index("ix_producto_estado").on(table.estado)
  ]
);
