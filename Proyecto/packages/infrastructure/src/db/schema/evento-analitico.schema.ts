import { mysqlTable, bigint, smallint, char, varchar, json, boolean, datetime, mysqlEnum, index } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { producto } from "./producto.schema.js";
import { oferta } from "./oferta.schema.js";
import { usuario } from "./usuario.schema.js";
import { comuna } from "./comuna.schema.js";

// FUSION: reemplaza producto_vista + oferta_click + busqueda. Una fila por
// evento; las columnas no aplicables al tipo_evento quedan NULL. Particionar
// por mes (creado_en) si el volumen lo justifica.
export const eventoAnalitico = mysqlTable(
  "evento_analitico",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipoEvento: mysqlEnum("tipo_evento", ["vista_producto", "click_oferta", "busqueda"]).notNull(),
    // usado en vista_producto y click_oferta
    productoId: bigint("producto_id", { mode: "number" }).references(() => producto.id),
    // usado solo en click_oferta
    ofertaId: bigint("oferta_id", { mode: "number" }).references(() => oferta.id),
    // NULL si anonimo
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => usuario.id),
    sesionId: char("sesion_id", { length: 36 }).notNull(),
    comunaId: smallint("comuna_id").references(() => comuna.id),
    // usado solo en vista_producto
    origen: mysqlEnum("origen", ["catalogo", "busqueda", "directo"]),
    // usado solo en click_oferta
    convirtio: boolean("convirtio"),
    // usado solo en busqueda
    termino: varchar("termino", { length: 160 }),
    // unsigned; usado solo en busqueda
    resultados: smallint("resultados"),
    // payload adicional libre por tipo_evento, si se necesita
    detalle: json("detalle"),
    creadoEn: datetime("creado_en", { mode: "date" })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [
    index("ix_evento_analitico_tipo_evento").on(table.tipoEvento),
    index("ix_evento_analitico_sesion_id").on(table.sesionId),
    index("ix_evento_analitico_creado_en").on(table.creadoEn),
    index("ix_evento_analitico_producto_id").on(table.productoId),
    index("ix_evento_analitico_oferta_id").on(table.ofertaId)
  ]
);
