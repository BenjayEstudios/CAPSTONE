import { mysqlTable, bigint, smallint, char, varchar, json, boolean, datetime, mysqlEnum, index, primaryKey } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

// FUSION: reemplaza producto_vista + oferta_click + busqueda. Una fila por
// evento; las columnas no aplicables al tipo_evento quedan NULL.
//
// PARTICIONADA por mes en creado_en (KAN-140, migrations/0004): Drizzle no
// sabe declarar particiones, el DDL esta a mano en la migracion y los meses
// siguientes los crea `pnpm db:particiones` (src/db/particiones.ts). InnoDB
// exige que la columna de particion este en toda PK/UNIQUE (por eso la PK es
// (id, creado_en)) y no admite foreign keys en tablas particionadas: producto_id,
// oferta_id, usuario_id y comuna_id NO tienen FK, el backend valida que
// existan al registrar el evento.
export const eventoAnalitico = mysqlTable(
  "evento_analitico",
  {
    id: bigint("id", { mode: "number" }).autoincrement().notNull(),
    tipoEvento: mysqlEnum("tipo_evento", ["vista_producto", "click_oferta", "busqueda"]).notNull(),
    // -> producto.id (sin FK). Usado en vista_producto y click_oferta.
    productoId: bigint("producto_id", { mode: "number" }),
    // -> oferta.id (sin FK). Usado solo en click_oferta.
    ofertaId: bigint("oferta_id", { mode: "number" }),
    // -> usuario.id (sin FK). NULL si anonimo.
    usuarioId: bigint("usuario_id", { mode: "number" }),
    sesionId: char("sesion_id", { length: 36 }).notNull(),
    // -> comuna.id (sin FK).
    comunaId: smallint("comuna_id"),
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
    primaryKey({ columns: [table.id, table.creadoEn] }),
    // Compuestos para las consultas de analitica (KAN-143, ver
    // docs/CONSULTAS_ANALITICA.md): cubren el filtro por fecha y, en
    // producto/oferta, responden el COUNT sin leer la fila.
    index("ix_evento_analitico_tipo_evento").on(table.tipoEvento, table.creadoEn),
    index("ix_evento_analitico_sesion_id").on(table.sesionId),
    index("ix_evento_analitico_creado_en").on(table.creadoEn),
    index("ix_evento_analitico_producto_id").on(table.productoId, table.tipoEvento, table.creadoEn),
    // oferta_id solo se llena en click_oferta: no hace falta tipo_evento.
    index("ix_evento_analitico_oferta_id").on(table.ofertaId, table.creadoEn, table.convirtio)
  ]
);
