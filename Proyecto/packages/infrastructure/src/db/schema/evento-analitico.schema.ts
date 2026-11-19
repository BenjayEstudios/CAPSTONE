import {
  mysqlTable,
  bigint,
  smallint,
  char,
  varchar,
  tinyint,
  json,
  mysqlEnum,
  datetime,
  index
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";
import { producto } from "./producto.schema.js";
import { oferta } from "./oferta.schema.js";
import { usuario } from "./usuario.schema.js";
import { comuna } from "./comuna.schema.js";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table evento_analitico (evento
// unico; las columnas no aplicables al tipo_evento quedan NULL). usuario_id
// NULL si anonimo. resultados es smallint unsigned segun la nota del DBML.
export const eventoAnalitico = mysqlTable(
  "evento_analitico",
  {
    id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
    tipoEvento: mysqlEnum("tipo_evento", ["vista_producto", "click_oferta", "busqueda"]).notNull(),
    productoId: bigint("producto_id", { mode: "number" }).references(() => producto.id),
    ofertaId: bigint("oferta_id", { mode: "number" }).references(() => oferta.id),
    usuarioId: bigint("usuario_id", { mode: "number" }).references(() => usuario.id),
    sesionId: char("sesion_id", { length: 36 }).notNull(),
    comunaId: smallint("comuna_id").references(() => comuna.id),
    origen: mysqlEnum("origen", ["catalogo", "busqueda", "directo"]),
    convirtio: tinyint("convirtio"),
    termino: varchar("termino", { length: 160 }),
    resultados: smallint("resultados", { unsigned: true }),
    detalle: json("detalle"),
    creadoEn: datetime("creado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [
    index("evento_analitico_tipo_evento_idx").on(t.tipoEvento),
    index("evento_analitico_sesion_id_idx").on(t.sesionId),
    index("evento_analitico_creado_en_idx").on(t.creadoEn),
    index("evento_analitico_producto_id_idx").on(t.productoId),
    index("evento_analitico_oferta_id_idx").on(t.ofertaId)
  ]
);
