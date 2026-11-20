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
  index,
  primaryKey
} from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// Traduccion 1:1 de DataBase/dbDiagram.sql -> Table evento_analitico (evento
// unico; las columnas no aplicables al tipo_evento quedan NULL). usuario_id
// NULL si anonimo. resultados es smallint unsigned segun la nota del DBML.
//
// PARTICIONADA por mes en creado_en (KAN-140, migrations/0001_kan140_*.sql):
// Drizzle no sabe declarar particiones, el DDL esta a mano en la migracion y
// los meses siguientes los crea `pnpm db:particiones`. InnoDB exige la
// columna de particion en toda PK/UNIQUE (PK = (id, creado_en)) y no admite
// FKs en tablas particionadas: producto_id, oferta_id, usuario_id y
// comuna_id son referencias logicas SIN FK que valida el backend.
export const eventoAnalitico = mysqlTable(
  "evento_analitico",
  {
    id: bigint("id", { mode: "number" }).autoincrement().notNull(),
    tipoEvento: mysqlEnum("tipo_evento", ["vista_producto", "click_oferta", "busqueda"]).notNull(),
    productoId: bigint("producto_id", { mode: "number" }),
    ofertaId: bigint("oferta_id", { mode: "number" }),
    usuarioId: bigint("usuario_id", { mode: "number" }),
    sesionId: char("sesion_id", { length: 36 }).notNull(),
    comunaId: smallint("comuna_id"),
    origen: mysqlEnum("origen", ["catalogo", "busqueda", "directo"]),
    convirtio: tinyint("convirtio"),
    termino: varchar("termino", { length: 160 }),
    resultados: smallint("resultados", { unsigned: true }),
    detalle: json("detalle"),
    creadoEn: datetime("creado_en").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (t) => [
    primaryKey({ columns: [t.id, t.creadoEn] }),
    index("evento_analitico_tipo_evento_idx").on(t.tipoEvento),
    index("evento_analitico_sesion_id_idx").on(t.sesionId),
    index("evento_analitico_creado_en_idx").on(t.creadoEn),
    index("evento_analitico_producto_id_idx").on(t.productoId),
    index("evento_analitico_oferta_id_idx").on(t.ofertaId)
  ]
);
